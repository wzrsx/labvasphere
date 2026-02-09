package dto

// CreateProjectRequest - запрос на создание проекта
type CreateProjectRequest struct {
	Title         string  `json:"title"`
	Description   *string `json:"description,omitempty"`
	CoverImageURL *string `json:"cover_image_url,omitempty"`
	PanoramaURL   string  `json:"panorama_url"` // Относительный путь (например: "abc123.jpg")
}

// UpdateProjectRequest - запрос на обновление проекта
type UpdateProjectRequest struct {
	Title         *string `json:"title,omitempty"`
	Description   *string `json:"description,omitempty"`
	CoverImageURL *string `json:"cover_image_url,omitempty"`
	PanoramaURL   *string `json:"panorama_url,omitempty"`
	Status        *string `json:"status,omitempty"` // "draft" или "published"
}

// ProjectResponse - ответ с проектом (уже у вас есть)
type ProjectResponse struct {
	ID            string  `json:"id"`
	Title         string  `json:"title"`
	Description   *string `json:"description,omitempty"`
	CoverImageURL *string `json:"cover_image_url,omitempty"`
	PanoramaURL   string  `json:"panorama_url"` // ← уже полный URL
	AuthorID      string  `json:"author_id"`
	Status        string  `json:"status"`
	ViewsCount    int     `json:"views_count"`
	CreatedAt     string  `json:"created_at"`
	PublishedAt   *string `json:"published_at,omitempty"`
	UpdatedAt     string  `json:"updated_at"`
}
