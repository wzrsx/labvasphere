package handlers

import (
	"encoding/json"
	"labvasphere-api/internal/dto"
	"labvasphere-api/internal/models"
	"labvasphere-api/internal/storage/postgres"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

const mediaBaseURL = "http://localhost:8080/uploads"

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
	resp.PanoramaURL = mediaBaseURL + "/panoramas/" + p.PanoramaURL

	if p.PublishedAt != nil {
		pubStr := p.PublishedAt.Format(time.RFC3339)
		resp.PublishedAt = &pubStr
	}

	return resp
}

func (h *ProjectHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.List)
	r.Get("/{id}", h.GetByID)
}

func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	// Пагинация: ?limit=10&offset=0
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 10
	offset := 0

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	projects, err := h.projectRepo.ListPublished(r.Context(), limit, offset)
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
	json.NewEncoder(w).Encode(responses) // ← важно: не projects, а responses!
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
