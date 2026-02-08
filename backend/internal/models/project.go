package models

import (
	"time"
)

type Project struct {
	ID            string     `json:"id" db:"id"`
	Title         string     `json:"title" db:"title"`
	Description   *string    `json:"description,omitempty" db:"description"`
	CoverImageURL *string    `json:"cover_image_url,omitempty" db:"cover_image_url"`
	PanoramaURL   string     `json:"panorama_url" db:"panorama_url"`
	AuthorID      string     `json:"author_id" db:"author_id"`
	Status        string     `json:"status" db:"status"`
	ViewsCount    int        `json:"views_count" db:"views_count"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	PublishedAt   *time.Time `json:"published_at,omitempty" db:"published_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}
