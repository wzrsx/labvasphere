package models

import (
	"time"

	"github.com/google/uuid"
)

type Like struct {
	UserID    uuid.UUID `json:"user_id" db:"user_id"`
	ProjectID uuid.UUID `json:"project_id" db:"project_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
