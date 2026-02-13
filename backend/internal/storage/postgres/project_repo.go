package postgres

import (
	"context"
	"labvasphere-api/internal/models"
	"log"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProjectRepository struct {
	db        *pgxpool.Pool
	uploadDir string
}

func NewProjectRepository(db *pgxpool.Pool) *ProjectRepository {
	return &ProjectRepository{
		db:        db,
		uploadDir: "./uploads/panoramas",
	}
}

func (r *ProjectRepository) GetByID(ctx context.Context, id string) (*models.Project, error) {
	const query = `
		SELECT id, title, description, cover_image_url, panorama_url, author_id,
		       status, views_count, created_at, published_at, updated_at
		FROM projects
		WHERE id = $1
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
func (r *ProjectRepository) Create(project *models.Project) error {
	project.ID = uuid.New().String()

	const query = `
		INSERT INTO projects (
			id, title, description, cover_image_url, panorama_url, 
			author_id, status, views_count, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := r.db.Exec(context.Background(),
		query,
		project.ID,
		project.Title,
		project.Description,
		project.CoverImageURL,
		project.PanoramaURL,
		project.AuthorID,
		project.Status,
		project.ViewsCount,
		project.CreatedAt,
		project.UpdatedAt,
	)

	return err
}

func (r *ProjectRepository) Update(project *models.Project) error {
	const query = `
		UPDATE projects
		SET title = $1, description = $2, cover_image_url = $3, panorama_url = $4,
		    status = $5, updated_at = $6
		WHERE id = $7
	`

	_, err := r.db.Exec(context.Background(),
		query,
		project.Title,
		project.Description,
		project.CoverImageURL,
		project.PanoramaURL,
		project.Status,
		project.UpdatedAt,
		project.ID,
	)

	return err
}
func (r *ProjectRepository) Delete(id string) error {
	// Сначала получаем путь к файлу из БД
	const getQuery = `SELECT panorama_url FROM projects WHERE id = $1`
	var filename string
	err := r.db.QueryRow(context.Background(), getQuery, id).Scan(&filename)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil // Проект уже удалён — ничего не делаем
		}
		return err
	}

	// Удаляем запись из БД
	const deleteQuery = `DELETE FROM projects WHERE id = $1`
	_, err = r.db.Exec(context.Background(), deleteQuery, id)
	if err != nil {
		return err
	}

	// Удаляем файл с диска
	if filename != "" {
		filePath := filepath.Join(r.uploadDir, filename)
		if err := os.Remove(filePath); err != nil {
			// Логируем ошибку, но не прерываем удаление из БД
			log.Printf("⚠️ Не удалось удалить файл %s: %v", filePath, err)
		} else {
			log.Printf("✅ Файл %s успешно удалён", filePath)
		}
	}

	return nil
}
func (r *ProjectRepository) GetByAuthor(ctx context.Context, authorID string) ([]*models.Project, error) {
	const query = `
		SELECT id, title, description, cover_image_url, panorama_url, author_id,
		       status, views_count, created_at, published_at, updated_at
		FROM projects
		WHERE author_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, authorID)
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
