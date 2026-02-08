package postgres

import (
	"context"
	"labvasphere-api/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProjectRepository struct {
	db *pgxpool.Pool
}

func NewProjectRepository(db *pgxpool.Pool) *ProjectRepository {
	return &ProjectRepository{db: db}
}

func (r *ProjectRepository) GetByID(ctx context.Context, id string) (*models.Project, error) {
	const query = `
		SELECT id, title, description, cover_image_url, panorama_url, author_id,
		       status, views_count, created_at, published_at, updated_at
		FROM projects
		WHERE id = $1 AND status = 'published'
	`

	row := r.db.QueryRow(ctx, query, id)

	var p models.Project
	err := row.Scan(
		&p.ID,
		&p.Title,
		&p.Description,
		&p.CoverImageURL,
		&p.PanoramaURL,
		&p.AuthorID,
		&p.Status,
		&p.ViewsCount,
		&p.CreatedAt,
		&p.PublishedAt,
		&p.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // не найден или не опубликован
		}
		return nil, err
	}

	return &p, nil
}
func (r *ProjectRepository) ListPublished(ctx context.Context, limit, offset int) ([]*models.Project, error) {
	const query = `
		SELECT id, title, description, cover_image_url, panorama_url, author_id,
		       status, views_count, created_at, published_at, updated_at
		FROM projects
		WHERE status = 'published'
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*models.Project
	for rows.Next() {
		var p models.Project
		err := rows.Scan(
			&p.ID,
			&p.Title,
			&p.Description,
			&p.CoverImageURL,
			&p.PanoramaURL,
			&p.AuthorID,
			&p.Status,
			&p.ViewsCount,
			&p.CreatedAt,
			&p.PublishedAt,
			&p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		projects = append(projects, &p)
	}

	return projects, nil
}
