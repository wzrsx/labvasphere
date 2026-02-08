// internal/dto/project.go
package dto

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
