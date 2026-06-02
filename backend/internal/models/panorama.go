package models

import (
	"time"

	"github.com/google/uuid"
)

// Panorama представляет панораму проекта
type Panorama struct {
	ID               uuid.UUID `json:"id" db:"id"`
	ProjectID        uuid.UUID `json:"project_id" db:"project_id"`
	Filename         string    `json:"filename" db:"filename"`
	OriginalFilename string    `json:"original_filename" db:"original_filename"`
	Title            string    `json:"title" db:"title"`
	Description      string    `json:"description" db:"description"`
	FileSize         int64     `json:"file_size,omitempty" db:"file_size"`
	MimeType         string    `json:"mime_type,omitempty" db:"mime_type"`
	ThumbnailURL     string    `json:"thumbnail_url,omitempty" db:"thumbnail_url"`
	IsMain           bool      `json:"is_main" db:"is_main"`
	IsActive         bool      `json:"is_active" db:"is_active"`
	SortOrder        int       `json:"sort_order" db:"sort_order"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// PanoramaCreateRequest — запрос на создание панорамы
type PanoramaCreateRequest struct {
	ProjectID        uuid.UUID `json:"project_id"`
	Filename         string    `json:"filename"`
	OriginalFilename string    `json:"original_filename"`
	Title            string    `json:"title,omitempty"`
	Description      string    `json:"description,omitempty"`
	IsMain           bool      `json:"is_main,omitempty"`
	FileSize         int64     `json:"file_size,omitempty"`
	MimeType         string    `json:"mime_type,omitempty"`
	ThumbnailURL     string    `json:"thumbnail_url,omitempty"`
}

// PanoramaUpdateRequest — запрос на обновление панорамы
type PanoramaUpdateRequest struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	IsMain      *bool   `json:"is_main,omitempty"`
	SortOrder   *int    `json:"sort_order,omitempty"`
	IsActive    *bool   `json:"is_active,omitempty"`
}

// PanoramaResponse — ответ клиенту
type PanoramaResponse struct {
	ID               uuid.UUID `json:"id"`
	ProjectID        uuid.UUID `json:"project_id"`
	Filename         string    `json:"filename"`
	OriginalFilename string    `json:"original_filename"`
	Title            string    `json:"title"`
	Description      string    `json:"description"`
	FileSize         int64     `json:"file_size,omitempty"`
	MimeType         string    `json:"mime_type,omitempty"`
	ThumbnailURL     string    `json:"thumbnail_url,omitempty"`
	IsMain           bool      `json:"is_main"`
	IsActive         bool      `json:"is_active"`
	SortOrder        int       `json:"sort_order"`
	CreatedAt        string    `json:"created_at"`
	UpdatedAt        string    `json:"updated_at"`
}

// ToResponse конвертирует модель в ответ
func (p *Panorama) ToResponse() *PanoramaResponse {
	return &PanoramaResponse{
		ID:               p.ID,
		ProjectID:        p.ProjectID,
		Filename:         p.Filename,
		OriginalFilename: p.OriginalFilename,
		Title:            p.Title,
		Description:      p.Description,
		FileSize:         p.FileSize,
		MimeType:         p.MimeType,
		ThumbnailURL:     p.ThumbnailURL,
		IsMain:           p.IsMain,
		IsActive:         p.IsActive,
		SortOrder:        p.SortOrder,
		CreatedAt:        p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        p.UpdatedAt.Format(time.RFC3339),
	}
}
