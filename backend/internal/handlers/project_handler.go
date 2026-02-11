package handlers

import (
	"encoding/json"
	"labvasphere-api/internal/dto"
	"labvasphere-api/internal/middleware"
	"labvasphere-api/internal/models"
	"labvasphere-api/internal/storage/postgres"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

const mediaBaseURL = "http://localhost:8081/uploads"

type ProjectHandler struct {
	projectRepo *postgres.ProjectRepository
}

func NewProjectHandler(projectRepo *postgres.ProjectRepository) *ProjectHandler {
	return &ProjectHandler{projectRepo: projectRepo}
}

func toProjectResponse(p *models.Project) *dto.ProjectResponse {
	resp := &dto.ProjectResponse{
		ID:          p.ID,
		Title:       p.Title,
		Description: p.Description,
		AuthorID:    p.AuthorID,
		Status:      p.Status,
		ViewsCount:  p.ViewsCount,
		CreatedAt:   p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   p.UpdatedAt.Format(time.RFC3339),
	}

	// Формируем полные URL
	if p.CoverImageURL != nil {
		url := mediaBaseURL + "/covers/" + *p.CoverImageURL
		resp.CoverImageURL = &url
	}

	// ← Ключевое исправление: формируем полный URL для панорамы
	resp.PanoramaURL = mediaBaseURL + "/panoramas/" + p.PanoramaURL

	if p.PublishedAt != nil {
		pubStr := p.PublishedAt.Format(time.RFC3339)
		resp.PublishedAt = &pubStr
	}

	return resp
}

func (h *ProjectHandler) RegisterRoutes(r chi.Router) {
	r.Post("/", h.CreateProject)
	r.Get("/", h.List)
	r.Get("/{id}", h.GetByID)
	r.Put("/{id}", h.UpdateProject)
	r.Delete("/{id}", h.DeleteProject)
}

// List получает проекты ТЕКУЩЕГО авторизованного пользователя
func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	// Получаем ВСЕ проекты автора (включая черновики)
	projects, err := h.projectRepo.GetByAuthor(r.Context(), claims.UserID)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Преобразуем в DTO с полными URL
	var responses []*dto.ProjectResponse
	for _, p := range projects {
		responses = append(responses, toProjectResponse(p))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(responses)
}

func (h *ProjectHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	// Простая валидация UUID (можно улучшить)
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

func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	// Получаем данные пользователя из контекста
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

	// Валидация
	if req.Title == "" {
		http.Error(w, "Название проекта обязательно", http.StatusBadRequest)
		return
	}

	if req.PanoramaURL == "" {
		http.Error(w, "URL панорамы обязателен", http.StatusBadRequest)
		return
	}

	// Создаём проект
	project := &models.Project{
		Title:         req.Title,
		Description:   req.Description,
		CoverImageURL: req.CoverImageURL,
		PanoramaURL:   req.PanoramaURL,
		AuthorID:      claims.UserID,
		Status:        "draft", // или "published" если нужно
		ViewsCount:    0,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	err := h.projectRepo.Create(project)
	if err != nil {
		http.Error(w, "Ошибка при создании проекта", http.StatusInternalServerError)
		return
	}

	resp := toProjectResponse(project)
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

	// Получаем существующий проект для проверки авторства
	existing, err := h.projectRepo.GetByID(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Ошибка при получении проекта", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "Проект не найден", http.StatusNotFound)
		return
	}

	// Проверяем, что пользователь является автором
	if existing.AuthorID != claims.UserID {
		http.Error(w, "Недостаточно прав", http.StatusForbidden)
		return
	}

	// Обновляем поля
	if req.Title != nil {
		existing.Title = *req.Title
	}
	if req.Description != nil {
		existing.Description = req.Description
	}
	if req.CoverImageURL != nil {
		existing.CoverImageURL = req.CoverImageURL
	}
	if req.PanoramaURL != nil {
		existing.PanoramaURL = *req.PanoramaURL
	}
	if req.Status != nil {
		existing.Status = *req.Status
	}
	existing.UpdatedAt = time.Now()

	err = h.projectRepo.Update(existing)
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

	// Получаем существующий проект для проверки авторства
	existing, err := h.projectRepo.GetByID(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Ошибка при получении проекта", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "Проект не найден", http.StatusNotFound)
		return
	}

	// Проверяем, что пользователь является автором
	if existing.AuthorID != claims.UserID {
		http.Error(w, "Недостаточно прав", http.StatusForbidden)
		return
	}

	err = h.projectRepo.Delete(projectID)
	if err != nil {
		http.Error(w, "Ошибка при удалении проекта", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
