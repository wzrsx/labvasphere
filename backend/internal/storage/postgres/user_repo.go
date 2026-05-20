package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"labvasphere-api/internal/models"
	"labvasphere-api/internal/security"
	"labvasphere-api/internal/validators"
)

var (
	ErrUserExists       = errors.New("user already exists")
	ErrReferrerNotFound = errors.New("referrer not found")
)

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// CreateUserWithReferral создаёт пользователя и привязывает рефералов (в транзакции)
func (r *UserRepository) CreateUserWithReferral(ctx context.Context, user *models.User, refUUID *uuid.UUID) error {
	// Валидация
	if err := validators.ValidateFullName(user.FullName); err != nil {
		return err
	}
	if err := validators.ValidatePassword(user.Password); err != nil {
		return err
	}

	// Хэширование пароля
	hashedPassword, err := security.HashPassword(user.Password)
	if err != nil {
		return err
	}
	user.PasswordHash = hashedPassword
	user.ID = uuid.New().String()

	// Начинаем транзакцию
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx) // Откат, если не будет коммита

	// 1. Создаём пользователя
	query := `
		INSERT INTO users (id, full_name, email, password_hash, avatar_url, bio, role)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING created_at, updated_at
	`
	err = tx.QueryRow(ctx, query,
		user.ID, user.FullName, user.Email, user.PasswordHash,
		user.AvatarURL, user.Bio, user.Role,
	).Scan(&user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		// Проверяем на уникальный email
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23505" {
			return ErrUserExists
		}
		return fmt.Errorf("create user: %w", err)
	}

	// 2. Если есть реферальный код — создаём связи
	if refUUID != nil {
		newUserID, _ := uuid.Parse(user.ID)

		// Проверяем, что реферал существует и не ссылается сам на себя
		var referrerExists bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, refUUID).Scan(&referrerExists)
		if err != nil {
			return fmt.Errorf("check referrer: %w", err)
		}
		if !referrerExists {
			return ErrReferrerNotFound
		}
		if *refUUID == newUserID {
			return fmt.Errorf("self-referral not allowed")
		}

		// Создаём связь уровня 1
		_, err = tx.Exec(ctx, `
			INSERT INTO referrals (partner_id, referred_user_id, level, created_at)
			VALUES ($1, $2, 1, NOW())
			ON CONFLICT (partner_id, referred_user_id) DO NOTHING
		`, refUUID, newUserID)
		if err != nil {
			return fmt.Errorf("create referral level 1: %w", err)
		}

		// 🔁 Рекурсивно добавляем уровни 2 и 3
		if err := r.createUplineReferrals(ctx, tx, newUserID, 2); err != nil {
			return fmt.Errorf("create upline referrals: %w", err)
		}
	}

	// Коммитим транзакцию
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// createUplineReferrals — рекурсивно добавляет уровни 2 и 3
func (r *UserRepository) createUplineReferrals(ctx context.Context, tx pgx.Tx, currentUserID uuid.UUID, level int) error {
	if level > 3 {
		return nil // Максимум 3 уровня
	}

	// Находим, кто пригласил текущего "партнёра" (его реферала уровня 1)
	var uplinePartnerID *uuid.UUID
	err := tx.QueryRow(ctx, `
		SELECT partner_id FROM referrals 
		WHERE referred_user_id = $1 AND level = 1
	`, currentUserID).Scan(&uplinePartnerID)

	if err == pgx.ErrNoRows {
		return nil // Нет вышестоящего партнёра — цепочка закончилась
	}
	if err != nil {
		return err
	}
	if uplinePartnerID == nil {
		return nil
	}

	// Создаём связь текущего пользователя с вышестоящим партнёром на новом уровне
	_, err = tx.Exec(ctx, `
		INSERT INTO referrals (partner_id, referred_user_id, level, created_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (partner_id, referred_user_id) DO NOTHING
	`, uplinePartnerID, currentUserID, level)
	if err != nil {
		return err
	}

	// Рекурсия для следующего уровня
	return r.createUplineReferrals(ctx, tx, currentUserID, level+1)
}

// CreateUser создает нового пользователя
func (r *UserRepository) CreateUser(user *models.User) error {
	// Валидация ФИО
	if err := validators.ValidateFullName(user.FullName); err != nil {
		return err // ← Ошибка возвращается на фронтенд
	}
	// Валидация пароля
	if err := validators.ValidatePassword(user.Password); err != nil {
		return err
	}

	// Хэширование пароля
	hashedPassword, err := security.HashPassword(user.Password)
	if err != nil {
		return err
	}

	user.PasswordHash = hashedPassword
	user.ID = uuid.New().String() // Преобразуем в строку

	query := `
        INSERT INTO users (id, full_name, email, password_hash, avatar_url, bio, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING created_at, updated_at
    `

	err = r.db.QueryRow(context.Background(),
		query,
		user.ID,
		user.FullName,
		user.Email,
		user.PasswordHash,
		user.AvatarURL,
		user.Bio,
		user.Role,
	).Scan(&user.CreatedAt, &user.UpdatedAt)

	return err
}

// GetUserByEmail получает пользователя по email
func (r *UserRepository) GetUserByEmail(email string) (*models.User, error) {
	user := &models.User{}

	query := `
        SELECT id, full_name, email, password_hash, avatar_url, bio, role, created_at, updated_at
        FROM users
        WHERE email = $1
    `

	err := r.db.QueryRow(context.Background(), query, email).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.Bio,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("пользователь не найден")
	}

	return user, err
}

// GetByID получает пользователя по ID
func (r *UserRepository) GetByID(ctx context.Context, id string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT id, full_name, email, password_hash, avatar_url, bio, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	err := r.db.QueryRow(context.Background(), query, id).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.PasswordHash,
		&user.AvatarURL,
		&user.Bio,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("пользователь не найден")
	}

	return user, err
}
func (r *UserRepository) Update(user *models.User) error {
	const query = `
		UPDATE users
		SET full_name = $1, avatar_url = $2, bio = $3, updated_at = NOW()
		WHERE id = $4
		RETURNING updated_at
	`

	err := r.db.QueryRow(context.Background(),
		query,
		user.FullName,
		user.AvatarURL,
		user.Bio,
		user.ID,
	).Scan(&user.UpdatedAt)

	return err
}

// UpdatePassword обновляет пароль пользователя по ID
func (r *UserRepository) UpdatePassword(ctx context.Context, userID string, newPassword string) error {
	// Хэшируем пароль перед сохранением
	hash, err := security.HashPassword(newPassword)
	if err != nil {
		return err
	}

	query := `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`

	_, err = r.db.Exec(ctx, query, hash, userID)
	return err
}

// VerifyPassword проверяет пароль пользователя
func (r *UserRepository) VerifyPassword(email, password string) (*models.User, error) {
	user, err := r.GetUserByEmail(email)
	if err != nil {
		return nil, err
	}

	if !security.CheckPasswordHash(password, user.PasswordHash) {
		return nil, errors.New("неверный пароль")
	}

	// Очищаем хэш для безопасности
	user.PasswordHash = ""

	return user, nil
}

// UpdateAvatar обновляет URL аватара пользователя
func (r *UserRepository) UpdateAvatar(ctx context.Context, userID string, avatarURL string) error {
	var newAvatarURL *string
	if avatarURL != "" {
		newAvatarURL = &avatarURL
	}

	query := `
		UPDATE users 
		SET avatar_url = $1, updated_at = NOW() 
		WHERE id = $2
		RETURNING updated_at
	`

	err := r.db.QueryRow(ctx, query, newAvatarURL, userID).Scan(&time.Time{})
	return err
}

// GetAvatarURL возвращает URL аватара пользователя (вспомогательный метод)
func (r *UserRepository) GetAvatarURL(ctx context.Context, userID string) (*string, error) {
	var avatarURL *string
	query := `SELECT avatar_url FROM users WHERE id = $1`
	err := r.db.QueryRow(ctx, query, userID).Scan(&avatarURL)
	if err == sql.ErrNoRows {
		return nil, errors.New("пользователь не найден")
	}
	return avatarURL, err
}

// GetPublicInfoByID получает только публичные поля пользователя по ID
func (r *UserRepository) GetPublicInfoByID(ctx context.Context, id string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT id, full_name, email, avatar_url, bio, role, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.AvatarURL,
		&user.Bio,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Очищаем приватные данные
	user.Email = ""
	user.PasswordHash = ""

	return user, nil
}
