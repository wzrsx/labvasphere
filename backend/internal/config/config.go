// internal/config/config.go
package config

import (
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
}

func MustLoad() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		panic("DATABASE_URL is required")
	}

	// Можно добавить валидацию

	return &Config{
		Port:        port,
		DatabaseURL: databaseURL,
	}
}
