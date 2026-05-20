package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserSettingsRepository interface {
	GetByUserID(ctx context.Context, userID string) (map[string]interface{}, error)
	Upsert(ctx context.Context, userID string, preferences map[string]interface{}) error
}

type userSettingsRepo struct {
	pool *pgxpool.Pool
}

func NewUserSettingsRepository(pool *pgxpool.Pool) UserSettingsRepository {
	return &userSettingsRepo{pool: pool}
}

// GetByUserID получает настройки пользователя
// Возвращает (nil, nil) если записи нет — хендлер подставит дефолт
func (r *userSettingsRepo) GetByUserID(ctx context.Context, userID string) (map[string]interface{}, error) {
	log.Printf("[DEBUG] Repo.GetByUserID: user_id=%s", userID)

	var rawJSON []byte
	err := r.pool.QueryRow(ctx, "SELECT preferences FROM user_settings WHERE user_id = $1", userID).Scan(&rawJSON)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("[DEBUG] No settings found for user_id=%s, returning defaults", userID)
			return nil, nil
		}
		log.Printf("[ERROR] QueryRow failed: %v, user_id=%s", err, userID)
		return nil, fmt.Errorf("get user settings: %w", err)
	}

	var prefs map[string]interface{}
	if err := json.Unmarshal(rawJSON, &prefs); err != nil {
		log.Printf("[ERROR] JSON unmarshal failed: %v, raw=%q", err, string(rawJSON))
		return nil, fmt.Errorf("unmarshal preferences: %w", err)
	}

	log.Printf("[DEBUG] Repo.GetByUserID success: user_id=%s, keys=%v", userID, getMapKeys(prefs))
	return prefs, nil
}

func (r *userSettingsRepo) Upsert(ctx context.Context, userID string, preferences map[string]interface{}) error {
	log.Printf("[DEBUG] Repo.Upsert: user_id=%s, new_prefs=%+v", userID, preferences)

	jsonData, err := json.Marshal(preferences)
	if err != nil {
		return fmt.Errorf("marshal preferences: %w", err)
	}

	// 🔹 PostgreSQL оператор || объединяет JSONB объекты
	// existing.preferences || new_prefs = merge
	query := `
		INSERT INTO user_settings (user_id, preferences, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (user_id) 
		DO UPDATE SET 
			preferences = user_settings.preferences || $2::jsonb,
			updated_at = NOW()
	`

	_, err = r.pool.Exec(ctx, query, userID, jsonData)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			log.Printf("[ERROR] PostgreSQL error: code=%s, message=%s", pgErr.Code, pgErr.Message)
			if pgErr.Code == "23503" { // foreign_key_violation
				return fmt.Errorf("user not found: %w", err)
			}
		}
		log.Printf("[ERROR] Exec failed: %v, user_id=%s", err, userID)
		return fmt.Errorf("upsert user settings: %w", err)
	}

	log.Printf("[DEBUG] Repo.Upsert success: user_id=%s, merged keys=%v", userID, getMapKeys(preferences))
	return nil
}

// 🔹 Вспомогательная: получить ключи мапы для лога (необязательно, но удобно для отладки)
func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
