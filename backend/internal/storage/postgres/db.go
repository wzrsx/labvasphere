// internal/storage/postgres/db.go
package postgres

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewDB создаёт пул подключений к PostgreSQL.
func NewDB(dataSourceName string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(context.Background(), dataSourceName)
	if err != nil {
		return nil, err
	}

	// Проверяем подключение
	if err = pool.Ping(context.Background()); err != nil {
		pool.Close()
		return nil, err
	}

	log.Println("✅ Successfully connected to PostgreSQL")
	return pool, nil
}
