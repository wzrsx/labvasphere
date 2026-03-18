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

// 🔹 toProjectResponse работает с ProjectWithMainPanorama
func toProjectResponse(p *models.ProjectWithMainPanorama) *dto.ProjectResponse {
	resp := &dto.ProjectResponse{
		ID:          p.Project.ID,
		Title:       p.Project.Title,
		Description: p.Project.Description,
		AuthorID:    p.Project.AuthorID,
		AuthorName:  p.Project.AuthorName,
		Status:      p.Project.Status,
		ViewsCount:  p.Project.ViewsCount,
		CreatedAt:   p.Project.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   p.Project.UpdatedAt.Format(time.RFC3339),
	}

	// Обложка
	if p.Project.CoverImageURL != nil && *p.Project.CoverImageURL != "" {
		coverPath := *p.Project.CoverImageURL
		resp.CoverImageURL = &coverPath
	}

	// 🔹 Основная панорама (ВМЕСТО panorama_url)
	if p.MainPanorama != nil {
		resp.MainPanorama = p.MainPanorama
	}

	if p.Project.PublishedAt != nil {
		pubStr := p.Project.PublishedAt.Format(time.RFC3339)
		resp.PublishedAt = &pubStr
	}

	return resp
}

func (h *ProjectHandler) RegisterRoutes(r chi.Router) {
	r.Get("/published", h.ListPublished)
	r.Get("/{id}", h.GetByID)
	r.Post("/", h.CreateProject)
	r.Get("/", h.List)
	r.Put("/{id}", h.UpdateProject)
	r.Delete("/{id}", h.DeleteProject)
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
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
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

// 🔹 CreateProject создаёт проект + основную панораму (если передан файл)
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

	// 🔹 Если передана основная панорама — создаём запись в panoramas
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
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
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
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
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
