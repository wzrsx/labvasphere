package postgres

import (
	"context"
	"labvasphere-api/internal/models"
	"log"
	"os"
	"path/filepath"
	"time"

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
		uploadDir: "./uploads", // корень для projects/, covers/ и т.д.
	}
}

// ListPublished получает опубликованные проекты с основными панорамами
func (r *ProjectRepository) ListPublished(ctx context.Context, limit, offset int) ([]*models.ProjectWithMainPanorama, error) {
	const query = `
		SELECT 
			p.id, p.title, p.description, p.cover_image_url, p.author_id,
			u.full_name, p.status, p.views_count, p.created_at, p.published_at, p.updated_at,
			pan.id, pan.filename, pan.original_filename, pan.title, pan.description,
			pan.is_main, pan.is_active, pan.sort_order, pan.created_at, pan.updated_at
		FROM projects p
		INNER JOIN users u ON u.id = p.author_id
		LEFT JOIN panoramas pan ON pan.project_id = p.id AND pan.is_main = true AND pan.is_active = true
		WHERE p.status = 'published'
		ORDER BY p.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*models.ProjectWithMainPanorama

	for rows.Next() {
		var proj models.Project

		// 🔹 Указатели для nullable полей панорамы (10 штук, не 11!)
		var panID *string
		var panFilename, panOriginalFilename, panTitle, panDescription *string
		var panIsMain, panIsActive *bool
		var panSortOrder *int
		var panCreatedAt, panUpdatedAt *time.Time

		err := rows.Scan(
			// Project (11 полей)
			&proj.ID, &proj.Title, &proj.Description, &proj.CoverImageURL, &proj.AuthorID,
			&proj.AuthorName, &proj.Status, &proj.ViewsCount, &proj.CreatedAt, &proj.PublishedAt, &proj.UpdatedAt,
			// Panorama (10 полей — без panProjectID!)
			&panID, &panFilename, &panOriginalFilename, &panTitle, &panDescription,
			&panIsMain, &panIsActive, &panSortOrder, &panCreatedAt, &panUpdatedAt,
		)
		if err != nil {
			log.Printf("ERROR: rows.Scan failed: %v", err)
			return nil, err
		}

		// Конвертируем панораму в Response если есть
		var mainPanResp *models.PanoramaResponse
		if panID != nil && *panID != "" {
			panUUID, _ := uuid.Parse(*panID)

			panorama := models.Panorama{
				ID:               panUUID,
				ProjectID:        uuid.MustParse(proj.ID), // ← используем proj.ID
				Filename:         ptrStr(panFilename),
				OriginalFilename: ptrStr(panOriginalFilename),
				Title:            ptrStr(panTitle),
				Description:      ptrStr(panDescription),
				IsMain:           ptrBool(panIsMain),
				IsActive:         ptrBool(panIsActive),
				SortOrder:        ptrInt(panSortOrder),
				CreatedAt:        ptrTime(panCreatedAt),
				UpdatedAt:        ptrTime(panUpdatedAt),
			}
			mainPanResp = panorama.ToResponse()
		}

		projects = append(projects, &models.ProjectWithMainPanorama{
			Project:      proj,
			MainPanorama: mainPanResp,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if projects == nil {
		return []*models.ProjectWithMainPanorama{}, nil
	}

	return projects, nil
}

// Create создаёт проект + автоматически создаёт запись в panoramas если передана основная панорама
func (r *ProjectRepository) Create(ctx context.Context, project *models.Project, mainPanorama *models.Panorama) error {
	project.ID = uuid.New().String()

	// Транзакция: проект + панорама
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Создаём проект (без panorama_url)
	const projectQuery = `
		INSERT INTO projects (
			id, title, description, cover_image_url, 
			author_id, status, views_count, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err = tx.Exec(ctx, projectQuery,
		project.ID, project.Title, project.Description, project.CoverImageURL,
		project.AuthorID, project.Status, project.ViewsCount, project.CreatedAt, project.UpdatedAt,
	)
	if err != nil {
		return err
	}

	// 2. Если есть основная панорама — создаём запись в panoramas
	if mainPanorama != nil {
		mainPanorama.ID = uuid.New()
		mainPanorama.ProjectID, _ = uuid.Parse(project.ID)
		mainPanorama.IsMain = true
		mainPanorama.IsActive = true

		const panQuery = `
			INSERT INTO panoramas (
				id, project_id, filename, original_filename,
				title, description, is_main, is_active, sort_order, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		`
		_, err = tx.Exec(ctx, panQuery,
			mainPanorama.ID, mainPanorama.ProjectID, mainPanorama.Filename, mainPanorama.OriginalFilename,
			mainPanorama.Title, mainPanorama.Description, mainPanorama.IsMain, mainPanorama.IsActive, mainPanorama.SortOrder,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// Update обновляет проект (без panorama_url)
func (r *ProjectRepository) Update(ctx context.Context, project *models.Project) error {
	const query = `
		UPDATE projects
		SET title = $1, description = $2, cover_image_url = $3,
		    status = $4, updated_at = $5
		WHERE id = $6
	`

	_, err := r.db.Exec(ctx, query,
		project.Title, project.Description, project.CoverImageURL,
		project.Status, project.UpdatedAt, project.ID,
	)
	return err
}

// Delete удаляет проект и связанные файлы
func (r *ProjectRepository) Delete(ctx context.Context, id string) error {
	// Получаем пути к файлам перед удалением
	const getFilesQuery = `SELECT cover_image_url FROM projects WHERE id = $1`
	var coverURL *string
	err := r.db.QueryRow(ctx, getFilesQuery, id).Scan(&coverURL)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return err
	}

	// Удаляем запись из БД (каскадно удалит панорамы и хотспоты, если настроено)
	const deleteQuery = `DELETE FROM projects WHERE id = $1`
	_, err = r.db.Exec(ctx, deleteQuery, id)
	if err != nil {
		return err
	}

	// Удаляем файлы с диска
	// Примечание: для полной очистки нужно также удалить папку projects/{id}/
	if coverURL != nil && *coverURL != "" {
		filePath := filepath.Join(r.uploadDir, *coverURL)
		if err := os.Remove(filePath); err != nil {
			log.Printf("⚠️ Не удалось удалить обложку %s: %v", filePath, err)
		}
	}

	// Опционально: удалить всю папку проекта
	// projectDir := filepath.Join(r.uploadDir, "projects", id)
	// if err := os.RemoveAll(projectDir); err != nil {
	// 	log.Printf("⚠️ Не удалось удалить папку проекта %s: %v", projectDir, err)
	// }

	return nil
}

// GetByAuthor получает проекты автора с основными панорамами
func (r *ProjectRepository) GetByAuthor(ctx context.Context, authorID string) ([]*models.ProjectWithMainPanorama, error) {
	const query = `
		SELECT 
			p.id, p.title, p.description, p.cover_image_url, p.author_id,
			p.status, p.views_count, p.created_at, p.published_at, p.updated_at,
			pan.id, pan.filename, pan.original_filename, pan.title, pan.description,
			pan.is_main, pan.is_active, pan.sort_order, pan.created_at, pan.updated_at
		FROM projects p
		LEFT JOIN panoramas pan ON pan.project_id = p.id AND pan.is_main = true AND pan.is_active = true
		WHERE p.author_id = $1
		ORDER BY p.created_at DESC
	`

	rows, err := r.db.Query(ctx, query, authorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []*models.ProjectWithMainPanorama

	for rows.Next() {
		var proj models.Project

		// Указатели для nullable полей панорамы
		var panID *string
		var panFilename, panOriginalFilename, panTitle, panDescription *string
		var panIsMain, panIsActive *bool
		var panSortOrder *int
		var panCreatedAt, panUpdatedAt *time.Time

		err := rows.Scan(
			// Project
			&proj.ID, &proj.Title, &proj.Description, &proj.CoverImageURL, &proj.AuthorID,
			&proj.Status, &proj.ViewsCount, &proj.CreatedAt, &proj.PublishedAt, &proj.UpdatedAt,
			// Panorama (nullable)
			&panID, &panFilename, &panOriginalFilename, &panTitle,
			&panDescription, &panIsMain, &panIsActive, &panSortOrder, &panCreatedAt, &panUpdatedAt,
		)
		if err != nil {
			log.Printf("ERROR: rows.Scan failed: %v", err)
			return nil, err
		}

		// Конвертируем панораму в Response если есть
		var mainPanResp *models.PanoramaResponse
		if panID != nil && *panID != "" {
			panUUID, _ := uuid.Parse(*panID)

			panorama := models.Panorama{
				ID:               panUUID,
				ProjectID:        uuid.MustParse(proj.ID),
				Filename:         ptrStr(panFilename),
				OriginalFilename: ptrStr(panOriginalFilename),
				Title:            ptrStr(panTitle),
				Description:      ptrStr(panDescription),
				IsMain:           ptrBool(panIsMain),
				IsActive:         ptrBool(panIsActive),
				SortOrder:        ptrInt(panSortOrder),
				CreatedAt:        ptrTime(panCreatedAt),
				UpdatedAt:        ptrTime(panUpdatedAt),
			}
			mainPanResp = panorama.ToResponse()
		}

		projects = append(projects, &models.ProjectWithMainPanorama{
			Project:      proj,
			MainPanorama: mainPanResp,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if projects == nil {
		return []*models.ProjectWithMainPanorama{}, nil
	}

	return projects, nil
}

// GetMainPanoramaByProject получает основную панораму проекта
func (r *ProjectRepository) GetMainPanoramaByProject(ctx context.Context, projectID string) (*models.Panorama, error) {
	const query = `
		SELECT id, project_id, filename, original_filename, title, description,
		       file_size, mime_type, thumbnail_url, is_main, is_active, sort_order, created_at, updated_at
		FROM panoramas
		WHERE project_id = $1 AND is_main = true AND is_active = true
	`

	var pan models.Panorama
	err := r.db.QueryRow(ctx, query, projectID).Scan(
		&pan.ID, &pan.ProjectID, &pan.Filename, &pan.OriginalFilename, &pan.Title, &pan.Description,
		&pan.FileSize, &pan.MimeType, &pan.ThumbnailURL, &pan.IsMain, &pan.IsActive, &pan.SortOrder,
		&pan.CreatedAt, &pan.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &pan, nil
}

// GetByID получает проект + основную панораму (безопасная версия с обработкой NULL)
func (r *ProjectRepository) GetByID(ctx context.Context, id string) (*models.ProjectWithMainPanorama, error) {
	const query = `
		SELECT 
			p.id, p.title, p.description, p.cover_image_url, p.author_id,
			p.status, p.views_count, p.created_at, p.published_at, p.updated_at,
			pan.id, pan.filename, pan.original_filename, pan.title, pan.description,
			pan.is_main, pan.is_active, pan.sort_order, pan.created_at, pan.updated_at
		FROM projects p
		LEFT JOIN panoramas pan ON pan.project_id = p.id AND pan.is_main = true AND pan.is_active = true
		WHERE p.id = $1
	`

	row := r.db.QueryRow(ctx, query, id)

	var proj models.Project

	// 🔹 Указатели для nullable полей панорамы
	var panID *string
	var panFilename, panOriginalFilename, panTitle, panDescription *string
	var panIsMain, panIsActive *bool
	var panSortOrder *int
	var panCreatedAt, panUpdatedAt *time.Time

	err := row.Scan(
		// Project fields (обязательные)
		&proj.ID, &proj.Title, &proj.Description, &proj.CoverImageURL, &proj.AuthorID,
		&proj.Status, &proj.ViewsCount, &proj.CreatedAt, &proj.PublishedAt, &proj.UpdatedAt,
		// Panorama fields (nullable — указатели)
		&panID, &panFilename, &panOriginalFilename, &panTitle,
		&panDescription, &panIsMain, &panIsActive, &panSortOrder, &panCreatedAt, &panUpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		log.Printf("ERROR: row.Scan failed: %v", err)
		return nil, err
	}

	// 🔹 Если панорама есть — собираем объект и конвертируем в Response
	var mainPanResp *models.PanoramaResponse
	if panID != nil && *panID != "" {
		panUUID, _ := uuid.Parse(*panID)

		panorama := models.Panorama{
			ID:               panUUID,
			ProjectID:        uuid.MustParse(proj.ID),
			Filename:         ptrStr(panFilename),
			OriginalFilename: ptrStr(panOriginalFilename),
			Title:            ptrStr(panTitle),
			Description:      ptrStr(panDescription),
			IsMain:           ptrBool(panIsMain),
			IsActive:         ptrBool(panIsActive),
			SortOrder:        ptrInt(panSortOrder),
			CreatedAt:        ptrTime(panCreatedAt),
			UpdatedAt:        ptrTime(panUpdatedAt),
		}
		mainPanResp = panorama.ToResponse() // ← КОНВЕРТАЦИЯ В RESPONSE
	}

	return &models.ProjectWithMainPanorama{
		Project:      proj,
		MainPanorama: mainPanResp, // ← *PanoramaResponse, не *Panorama!
	}, nil
}

// 🔹 Вспомогательные функции для безопасного получения значений
func ptrStr(s *string) string {
	if s != nil {
		return *s
	}
	return ""
}

func ptrBool(b *bool) bool {
	if b != nil {
		return *b
	}
	return false
}

func ptrInt(i *int) int {
	if i != nil {
		return *i
	}
	return 0
}

func ptrTime(t *time.Time) time.Time {
	if t != nil {
		return *t
	}
	return time.Time{}
}
