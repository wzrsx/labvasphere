package models

import (
	"time"
)

type User struct {
	ID           string    `json:"id" db:"id"`
	FullName     string    `json:"full_name" db:"full_name" validate:"required,min=2,max=100"`
	Email        string    `json:"email" db:"email" validate:"required,email"`
	Password     string    `json:"password,omitempty" validate:"required"` // только для входа/регистрации
	PasswordHash string    `json:"-" db:"password_hash"`
	AvatarURL    *string   `json:"avatar_url,omitempty" db:"avatar_url"`
	Bio          *string   `json:"bio,omitempty" db:"bio"`
	Role         string    `json:"role" db:"role" default:"user"` // "user", "designer"
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}
