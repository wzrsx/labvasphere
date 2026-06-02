package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"labvasphere-api/internal/dto"
	"labvasphere-api/internal/middleware"
	"labvasphere-api/internal/models"
	"labvasphere-api/internal/storage/postgres"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const mediaBaseURL = "http://localhost:8080"

type ProjectHandler struct {
	projectRepo  *postgres.ProjectRepository
	panoramaRepo *postgres.PanoramaRepository
	baseDir      string
}

func NewProjectHandler(projectRepo *postgres.ProjectRepository, panoramaRepo *postgres.PanoramaRepository, baseDir string) *ProjectHandler {
	os.MkdirAll(filepath.Join(baseDir, "projects"), 0755)
	return &ProjectHandler{
		projectRepo:  projectRepo,
		panoramaRepo: panoramaRepo,
		baseDir:      baseDir,
	}
}

// toProjectResponse работает с ProjectWithMainPanorama
func toProjectResponse(p *models.ProjectWithMainPanorama) *dto.ProjectResponse {
	resp := &dto.ProjectResponse{
		ID:          p.Project.ID,
		Title:       p.Project.Title,
		Description: p.Project.Description,
		AuthorID:    p.Project.AuthorID,
		Status:      p.Project.Status,
		ViewsCount:  p.Project.ViewsCount,
		CreatedAt:   p.Project.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   p.Project.UpdatedAt.Format(time.RFC3339),
	}

	if p.Project.CoverImageURL != nil && *p.Project.CoverImageURL != "" {
		coverPath := *p.Project.CoverImageURL
		resp.CoverImageURL = &coverPath
	}

	// Автор (если загружен)
	if p.Project.AuthorName != nil {
		resp.AuthorName = *p.Project.AuthorName
	}
	if p.Project.AuthorRole != nil {
		resp.AuthorRole = *p.Project.AuthorRole
	}

	if p.MainPanorama != nil {
		resp.MainPanorama = p.MainPanorama
	}

	if p.Project.PublishedAt != nil {
		pubStr := p.Project.PublishedAt.Format(time.RFC3339)
		resp.PublishedAt = &pubStr
	}

	return resp
}

func (h *ProjectHandler) ListPublished(w http.ResponseWriter, r *http.Request) {
	limit := 5
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 50 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	projects, err := h.projectRepo.ListPublished(r.Context(), limit, offset)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	var responses []*dto.ProjectResponse
	for _, p := range projects {
		responses = append(responses, toProjectResponse(p))
		log.Printf("Project ID: %s, AuthorName: '%s'\n", p.Project.ID, p.Project.AuthorName)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  responses,
		"total": len(responses),
	})
}

func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	projects, err := h.projectRepo.GetByAuthor(r.Context(), claims.UserID)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	var responses []*dto.ProjectResponse
	for _, p := range projects {
		responses = append(responses, toProjectResponse(p))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(responses)
}

func (h *ProjectHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	if len(projectID) != 36 {
		http.Error(w, "GetByID: Invalid project ID", http.StatusBadRequest)
		return
	}

	project, err := h.projectRepo.GetByID(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	if project == nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}
	resp := toProjectResponse(project)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// CreateProject создаёт проект + основную панораму (если передан файл)
func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	var req dto.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "Название проекта обязательно", http.StatusBadRequest)
		return
	}

	// Создаём проект (без panorama_url)
	project := &models.Project{
		Title:         req.Title,
		Description:   req.Description,
		CoverImageURL: req.CoverImageURL,
		AuthorID:      claims.UserID,
		Status:        "draft",
		ViewsCount:    0,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Если передана основная панорама — создаём запись в panoramas
	var mainPanorama *models.Panorama
	if req.PanoramaFilename != "" {
		mainPanorama = &models.Panorama{
			Filename:         req.PanoramaFilename,
			OriginalFilename: req.PanoramaOriginalName,
			Title:            req.Title + " - Основная панорама",
			Description:      "",
			IsMain:           true,
			IsActive:         true,
			SortOrder:        0,
		}
	}

	// Создаём проект + панораму в транзакции
	err := h.projectRepo.Create(r.Context(), project, mainPanorama)
	if err != nil {
		http.Error(w, "Ошибка при создании проекта: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Создаём папку проекта на диске
	projectDir := filepath.Join(h.baseDir, "projects", project.ID)
	if err := os.MkdirAll(filepath.Join(projectDir, "panoramas"), 0755); err != nil {
		log.Printf("Warning: failed to create project directory %s: %v", projectDir, err)
	}

	// Возвращаем проект с основной панорамой
	projectWithPan, err := h.projectRepo.GetByID(r.Context(), project.ID)
	if err != nil {
		http.Error(w, "Ошибка получения проекта", http.StatusInternalServerError)
		return
	}

	resp := toProjectResponse(projectWithPan)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *ProjectHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	projectID := chi.URLParam(r, "id")
	if len(projectID) != 36 {
		http.Error(w, "UpdateProject: Invalid project ID", http.StatusBadRequest)
		return
	}

	var req dto.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	existing, err := h.projectRepo.GetByID(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Ошибка при получении проекта", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "Проект не найден", http.StatusNotFound)
		return
	}

	if existing.Project.AuthorID != claims.UserID {
		http.Error(w, "Недостаточно прав", http.StatusForbidden)
		return
	}

	if req.Title != nil {
		existing.Project.Title = *req.Title
	}
	if req.Description != nil {
		existing.Project.Description = req.Description
	}
	if req.CoverImageURL != nil {
		existing.Project.CoverImageURL = req.CoverImageURL
	}
	if req.Status != nil {
		existing.Project.Status = *req.Status
	}
	existing.Project.UpdatedAt = time.Now()

	err = h.projectRepo.Update(r.Context(), &existing.Project)
	if err != nil {
		http.Error(w, "Ошибка при обновлении проекта", http.StatusInternalServerError)
		return
	}

	resp := toProjectResponse(existing)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *ProjectHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	projectID := chi.URLParam(r, "id")
	if len(projectID) != 36 {
		http.Error(w, "DeleteProject: Invalid project ID", http.StatusBadRequest)
		return
	}

	existing, err := h.projectRepo.GetByID(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Ошибка при получении проекта", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "Проект не найден", http.StatusNotFound)
		return
	}

	if existing.Project.AuthorID != claims.UserID {
		http.Error(w, "Недостаточно прав", http.StatusForbidden)
		return
	}

	// Удаляем из БД (каскадно удалит панорамы и хотспоты)
	err = h.projectRepo.Delete(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Ошибка при удалении проекта", http.StatusInternalServerError)
		return
	}

	// Удаляем папку с файлами
	projectDir := filepath.Join(h.baseDir, "projects", projectID)
	if err := os.RemoveAll(projectDir); err != nil {
		log.Printf("Warning: failed to remove project directory %s: %v", projectDir, err)
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetPublicProject — публичный просмотр проекта (без авторизации)
// Доступен только для проектов со статусом "published"
// GET /api/v1/projects/public/{id}
func (h *ProjectHandler) GetPublicProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	// Валидация UUID
	if len(projectID) != 36 {
		http.Error(w, "GetPublicProject: Invalid project ID", http.StatusBadRequest)
		return
	}

	// Получаем проект
	project, err := h.projectRepo.GetByID(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	if project == nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	// Показываем только опубликованные
	if project.Project.Status != "published" {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	// Возвращаем ответ через существующий toProjectResponse
	resp := toProjectResponse(project)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// LikeProject — переключение лайка: PUT /projects/{id}/like
func (h *ProjectHandler) LikeProject(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	// Парсим ID проекта
	projectIDStr := chi.URLParam(r, "id")
	if projectIDStr == "" {
		http.Error(w, `{"error":"ID проекта не указан"}`, http.StatusBadRequest)
		return
	}
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		http.Error(w, `{"error":"Неверный формат ID проекта"}`, http.StatusBadRequest)
		return
	}

	// Переключаем лайк
	liked, count, err := h.projectRepo.ToggleLike(r.Context(), projectID, claims.UserID)
	if err != nil {
		log.Printf("ERROR: ToggleLike failed: %v", err)
		http.Error(w, `{"error":"Ошибка при обновлении лайка"}`, http.StatusInternalServerError)
		return
	}

	// JSON-ответ
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"liked":       liked,
		"likes_count": count,
	})
}

// GetLikeStatus — получение статуса лайка: GET /projects/{id}/like/status
func (h *ProjectHandler) GetLikeStatus(w http.ResponseWriter, r *http.Request) {
	projectIDStr := chi.URLParam(r, "id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		http.Error(w, `{"error":"Неверный формат ID проекта"}`, http.StatusBadRequest)
		return
	}
	claims := middleware.GetUserFromContext(r.Context())

	var liked bool
	var count int

	if claims != nil {
		// Авторизованный пользователь — получаем персональный статус
		liked, count, err = h.projectRepo.GetLikeStatus(r.Context(), projectID, claims.UserID)
		log.Printf("GetLikeStatus AUTH")
		if err != nil {
			log.Printf("ERROR: GetLikeStatus failed: %v", err)
			http.Error(w, `{"error":"Ошибка при загрузке статуса"}`, http.StatusInternalServerError)
			return
		}
	} else {
		// Неавторизованный — только счётчик
		liked = false
		count, err = h.projectRepo.GetLikesCount(r.Context(), projectID)
		log.Printf("GetLikeStatus NOT AUTH")
		if err != nil {
			log.Printf("ERROR: GetLikesCount failed: %v", err)
			http.Error(w, `{"error":"Ошибка при загрузке счётчика"}`, http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"liked":       liked,
		"likes_count": count,
	})
}
func (h *ProjectHandler) IncrementViews(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	// Валидация UUID
	if len(projectID) != 36 {
		http.Error(w, "IncrementViews: Invalid project ID", http.StatusBadRequest)
		return
	}

	// Увеличиваем счетчик просмотров
	newCount, err := h.projectRepo.IncrementViews(r.Context(), projectID)
	if err != nil {
		log.Printf("Error incrementing views for project %s: %v", projectID, err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Возвращаем новое значение views_count
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"views_count": newCount,
	})
}
