package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"labvasphere-api/internal/models"
	"labvasphere-api/internal/security"
	"labvasphere-api/internal/validators"
)

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
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
