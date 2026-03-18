package dto

import "labvasphere-api/internal/models"

// CreateProjectRequest — запрос на создание проекта
type CreateProjectRequest struct {
	Title                string  `json:"title"`
	Description          *string `json:"description,omitempty"`
	CoverImageURL        *string `json:"cover_image_url,omitempty"`
	PanoramaFilename     string  `json:"panorama_filename,omitempty"`      // для регистрации основной панорамы
	PanoramaOriginalName string  `json:"panorama_original_name,omitempty"` // оригинальное имя файла
	Status               string  `json:"status,omitempty"`
}

// UpdateProjectRequest — запрос на обновление проекта
type UpdateProjectRequest struct {
	Title         *string `json:"title,omitempty"`
	Description   *string `json:"description,omitempty"`
	CoverImageURL *string `json:"cover_image_url,omitempty"`
	Status        *string `json:"status,omitempty"`
}

// ProjectResponse — ответ клиенту
type ProjectResponse struct {
	ID            string                   `json:"id"`
	Title         string                   `json:"title"`
	Description   *string                  `json:"description,omitempty"`
	CoverImageURL *string                  `json:"cover_image_url,omitempty"`
	AuthorID      string                   `json:"author_id"`
	AuthorName    string                   `json:"author_name"`
	Status        string                   `json:"status"`
	ViewsCount    int                      `json:"views_count"`
	CreatedAt     string                   `json:"created_at"`
	PublishedAt   *string                  `json:"published_at,omitempty"`
	UpdatedAt     string                   `json:"updated_at"`
	MainPanorama  *models.PanoramaResponse `json:"main_panorama,omitempty"`
}
