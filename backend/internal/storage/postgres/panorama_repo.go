package postgres

import (
	"context"

	"labvasphere-api/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PanoramaRepository struct {
	pool *pgxpool.Pool
}

func NewPanoramaRepository(pool *pgxpool.Pool) *PanoramaRepository {
	return &PanoramaRepository{pool: pool}
}

func (r *PanoramaRepository) Create(ctx context.Context, p *models.Panorama) error {
	query := `
		INSERT INTO panoramas (
			id, project_id, filename, original_filename,
			title, description, is_main, is_active, sort_order, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
	`
	_, err := r.pool.Exec(ctx, query,
		p.ID, p.ProjectID, p.Filename, p.OriginalFilename,
		p.Title, p.Description, p.IsMain, p.IsActive, p.SortOrder,
	)
	return err
}

func (r *PanoramaRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Panorama, error) {
	query := `
		SELECT id, project_id, filename, original_filename, title, description,
		       file_size, mime_type, thumbnail_url, is_main, is_active, sort_order, created_at, updated_at
		FROM panoramas WHERE id = $1
	`
	var p models.Panorama
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.ProjectID, &p.Filename, &p.OriginalFilename, &p.Title, &p.Description,
		&p.FileSize, &p.MimeType, &p.ThumbnailURL, &p.IsMain, &p.IsActive, &p.SortOrder,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PanoramaRepository) GetByProject(ctx context.Context, projectID uuid.UUID) ([]*models.Panorama, error) {
	query := `
		SELECT id, project_id, filename, original_filename, title, description,
		       file_size, mime_type, thumbnail_url, is_main, is_active, sort_order, created_at, updated_at
		FROM panoramas WHERE project_id = $1 ORDER BY sort_order ASC, created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var panoramas []*models.Panorama
	for rows.Next() {
		var p models.Panorama
		err := rows.Scan(
			&p.ID, &p.ProjectID, &p.Filename, &p.OriginalFilename, &p.Title, &p.Description,
			&p.FileSize, &p.MimeType, &p.ThumbnailURL, &p.IsMain, &p.IsActive, &p.SortOrder,
			&p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		panoramas = append(panoramas, &p)
	}
	return panoramas, rows.Err()
}

// GetMainByProject получает основную панораму проекта
func (r *PanoramaRepository) GetMainByProject(ctx context.Context, projectID uuid.UUID) (*models.Panorama, error) {
	query := `
		SELECT id, project_id, filename, original_filename, title, description,
		       file_size, mime_type, thumbnail_url, is_main, is_active, sort_order, created_at, updated_at
		FROM panoramas 
		WHERE project_id = $1 AND is_main = true AND is_active = true
	`
	var p models.Panorama
	err := r.pool.QueryRow(ctx, query, projectID).Scan(
		&p.ID, &p.ProjectID, &p.Filename, &p.OriginalFilename, &p.Title, &p.Description,
		&p.FileSize, &p.MimeType, &p.ThumbnailURL, &p.IsMain, &p.IsActive, &p.SortOrder,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// Update обновляет панораму
func (r *PanoramaRepository) Update(ctx context.Context, p *models.Panorama) error {
	query := `
		UPDATE panoramas SET
			filename = $1, original_filename = $2, title = $3, description = $4,
			is_main = $5, is_active = $6, sort_order = $7, updated_at = NOW()
		WHERE id = $8
	`
	_, err := r.pool.Exec(ctx, query,
		p.Filename, p.OriginalFilename, p.Title, p.Description,
		p.IsMain, p.IsActive, p.SortOrder, p.ID,
	)
	return err
}

// Delete мягко удаляет панораму (is_active = false)
func (r *PanoramaRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE panoramas SET is_active = false, updated_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}
