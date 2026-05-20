package postgres

import (
	"context"
	"fmt"
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
	// 🔹 Запрос возвращает 22 поля (с author_name и author_role)
	const query = `
		SELECT 
			p.id, p.title, p.description, p.cover_image_url, p.author_id,
			u.full_name, u.role,
			p.status, p.views_count, p.created_at, p.published_at, p.updated_at,
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

		// Nullable поля панорамы (10 штук)
		var panID *string
		var panFilename, panOriginalFilename, panTitle, panDescription *string
		var panIsMain, panIsActive *bool
		var panSortOrder *int
		var panCreatedAt, panUpdatedAt *time.Time

		// 🔹 Scan: ровно 22 поля (12 проект + 10 панорама)
		err := rows.Scan(
			// Project (12 полей)
			&proj.ID, &proj.Title, &proj.Description, &proj.CoverImageURL, &proj.AuthorID,
			&proj.AuthorName, &proj.AuthorRole, // ← эти два поля ДОЛЖНЫ быть *string в модели
			&proj.Status, &proj.ViewsCount, &proj.CreatedAt, &proj.PublishedAt, &proj.UpdatedAt,
			// Panorama (10 полей)
			&panID, &panFilename, &panOriginalFilename, &panTitle, &panDescription,
			&panIsMain, &panIsActive, &panSortOrder, &panCreatedAt, &panUpdatedAt,
		)
		if err != nil {
			log.Printf("ERROR: ListPublished rows.Scan failed: %v", err)
			return nil, err
		}

		// Собираем панораму
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

	return projects, rows.Err()
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

// GetByID получает только данные проекта (без информации об авторе)
func (r *ProjectRepository) GetByID(ctx context.Context, id string) (*models.ProjectWithMainPanorama, error) {
	// 🔹 Запрос возвращает ровно 20 полей (без author_name/author_role)
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

	// Nullable поля панорамы (10 штук)
	var panID *string
	var panFilename, panOriginalFilename, panTitle, panDescription *string
	var panIsMain, panIsActive *bool
	var panSortOrder *int
	var panCreatedAt, panUpdatedAt *time.Time

	// 🔹 Scan: ровно 20 полей (10 проект + 10 панорама)
	err := row.Scan(
		// Project (10 полей)
		&proj.ID, &proj.Title, &proj.Description, &proj.CoverImageURL, &proj.AuthorID,
		&proj.Status, &proj.ViewsCount, &proj.CreatedAt, &proj.PublishedAt, &proj.UpdatedAt,
		// Panorama (10 полей)
		&panID, &panFilename, &panOriginalFilename, &panTitle, &panDescription,
		&panIsMain, &panIsActive, &panSortOrder, &panCreatedAt, &panUpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		log.Printf("ERROR: GetByID row.Scan failed: %v", err)
		return nil, err
	}

	// Собираем панораму если есть
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

	return &models.ProjectWithMainPanorama{
		Project:      proj,
		MainPanorama: mainPanResp,
	}, nil
}

// ToggleLike переключает лайк: добавляет или удаляет запись
// Возвращает: новый статус лайка (после операции) и общее количество
func (r *ProjectRepository) ToggleLike(ctx context.Context, projectID uuid.UUID, userID string) (bool, int, error) {
	// Проверяем, есть ли уже лайк
	var exists bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM public.likes WHERE project_id = $1 AND user_id = $2)`,
		projectID, userID,
	).Scan(&exists)
	if err != nil {
		return false, 0, fmt.Errorf("check like exists: %w", err)
	}

	if exists {
		// Удаляем лайк (по композитному ключу)
		_, err = r.db.Exec(ctx,
			`DELETE FROM public.likes WHERE project_id = $1 AND user_id = $2`,
			projectID, userID,
		)
		if err != nil {
			return false, 0, fmt.Errorf("delete like: %w", err)
		}
	} else {
		// Добавляем лайк (композитный PK создаётся автоматически)
		_, err = r.db.Exec(ctx,
			`INSERT INTO public.likes (user_id, project_id, created_at) VALUES ($1, $2, NOW())`,
			userID, projectID,
		)
		if err != nil {
			return false, 0, fmt.Errorf("insert like: %w", err)
		}
	}

	// Получаем актуальное количество лайков проекта
	var count int
	err = r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM public.likes WHERE project_id = $1`,
		projectID,
	).Scan(&count)
	if err != nil {
		return false, 0, fmt.Errorf("count likes: %w", err)
	}

	return !exists, count, nil // !exists = новый статус (поставили/убрали)
}

// GetLikeStatus проверяет, лайкнул ли текущий пользователь проект
func (r *ProjectRepository) GetLikeStatus(ctx context.Context, projectID uuid.UUID, userID string) (bool, int, error) {
	// Проверяем статус лайка
	var liked bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM public.likes WHERE project_id = $1 AND user_id = $2)`,
		projectID, userID,
	).Scan(&liked)
	if err != nil {
		return false, 0, fmt.Errorf("check like status: %w", err)
	}

	// Получаем счётчик
	var count int
	err = r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM public.likes WHERE project_id = $1`,
		projectID,
	).Scan(&count)
	if err != nil {
		return false, 0, fmt.Errorf("count likes: %w", err)
	}

	return liked, count, nil
}

// GetLikesCount возвращает количество лайков проекта (публичный метод)
func (r *ProjectRepository) GetLikesCount(ctx context.Context, projectID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM public.likes WHERE project_id = $1`,
		projectID,
	).Scan(&count)
	return count, err
}

// IncrementViews увеличивает счетчик просмотров проекта на 1
func (r *ProjectRepository) IncrementViews(ctx context.Context, id string) (int, error) {
	const query = `
                UPDATE projects
                SET views_count = views_count + 1, updated_at = NOW()
                WHERE id = $1
                RETURNING views_count
        `

	var newCount int
	err := r.db.QueryRow(ctx, query, id).Scan(&newCount)
	if err != nil {
		return 0, err
	}
	return newCount, nil
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
