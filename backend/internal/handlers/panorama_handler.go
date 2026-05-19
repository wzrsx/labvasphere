package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"labvasphere-api/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PanoramaRepository interface {
	Create(context.Context, *models.Panorama) error
	GetByID(context.Context, uuid.UUID) (*models.Panorama, error)
	GetByProject(context.Context, uuid.UUID) ([]*models.Panorama, error)
	GetMainByProject(context.Context, uuid.UUID) (*models.Panorama, error)
	Update(context.Context, *models.Panorama) error
	Delete(context.Context, uuid.UUID) error
}

type PanoramaHandler struct {
	repo PanoramaRepository
}

func NewPanoramaHandler(repo PanoramaRepository) *PanoramaHandler {
	return &PanoramaHandler{repo: repo}
}

func (h *PanoramaHandler) RegisterRoutes(r chi.Router) {
	r.Post("/register", h.Register)
	r.Get("/project/{project_id}", h.GetByProject)
	r.Get("/{id}", h.GetByID)
	r.Get("/project/{project_id}/main", h.GetMainByProject)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
}

// Register регистрирует панораму в БД после загрузки файла
func (h *PanoramaHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.PanoramaCreateRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}

	if req.ProjectID == uuid.Nil {
		writeError(w, http.StatusBadRequest, "project_id обязателен")
		return
	}
	if req.Filename == "" {
		writeError(w, http.StatusBadRequest, "filename обязателен")
		return
	}

	panorama := &models.Panorama{
		ID:               uuid.New(),
		ProjectID:        req.ProjectID,
		Filename:         req.Filename,
		OriginalFilename: req.OriginalFilename,
		Title:            req.Title,
		Description:      req.Description,
		IsMain:           req.IsMain,
		IsActive:         true,
		SortOrder:        0,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		FileSize:         req.FileSize,
		MimeType:         req.MimeType,
		ThumbnailURL:     req.ThumbnailURL,
	}

	if err := h.repo.Create(r.Context(), panorama); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка сохранения панорамы: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"panorama_id": panorama.ID.String(),
		"filename":    panorama.Filename,
		"project_id":  panorama.ProjectID.String(),
		"is_main":     panorama.IsMain,
	})
}

func (h *PanoramaHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный ID")
		return
	}

	panorama, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка получения панорамы")
		return
	}
	if panorama == nil {
		writeError(w, http.StatusNotFound, "Панорама не найдена")
		return
	}

	writeJSON(w, http.StatusOK, panorama.ToResponse())
}

func (h *PanoramaHandler) GetByProject(w http.ResponseWriter, r *http.Request) {
	projectIDStr := chi.URLParam(r, "project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный ID проекта")
		return
	}

	panoramas, err := h.repo.GetByProject(r.Context(), projectID)
	if err != nil {
		// 🔹 ВАЖНО: Пишем полную ошибку в консоль сервера
		// Смотрите в терминал, где запущен go run ...
		fmt.Printf("❌ DB ERROR GetByProject: %v\n", err)

		// И возвращаем детальную ошибку клиенту (для отладки)
		writeError(w, http.StatusInternalServerError, "Ошибка БД: "+err.Error())
		return
	}

	responses := make([]*models.PanoramaResponse, len(panoramas))
	for i, p := range panoramas {
		responses[i] = p.ToResponse()
	}

	writeJSON(w, http.StatusOK, responses)
}

// GetMainByProject получает основную панораму проекта
func (h *PanoramaHandler) GetMainByProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "project_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный ID проекта")
		return
	}

	panorama, err := h.repo.GetMainByProject(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка получения основной панорамы")
		return
	}
	if panorama == nil {
		writeError(w, http.StatusNotFound, "Основная панорама не найдена")
		return
	}

	writeJSON(w, http.StatusOK, panorama.ToResponse())
}

func (h *PanoramaHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный ID панорамы")
		return
	}

	var req models.PanoramaUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}

	// Получаем текущую панораму
	panorama, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка получения панорамы")
		return
	}
	if panorama == nil {
		writeError(w, http.StatusNotFound, "Панорама не найдена")
		return
	}

	// Обновляем поля
	if req.Title != nil {
		panorama.Title = *req.Title
	}
	if req.Description != nil {
		panorama.Description = *req.Description
	}
	if req.IsMain != nil {
		panorama.IsMain = *req.IsMain
	}
	if req.IsActive != nil {
		panorama.IsActive = *req.IsActive
	}
	if req.SortOrder != nil {
		panorama.SortOrder = *req.SortOrder
	}
	panorama.UpdatedAt = time.Now()

	if err := h.repo.Update(r.Context(), panorama); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка обновления панорамы")
		return
	}

	writeJSON(w, http.StatusOK, panorama.ToResponse())
}

func (h *PanoramaHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный ID панорамы")
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка удаления панорамы")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
func (h *PanoramaHandler) ListByProjectPublic(w http.ResponseWriter, r *http.Request) {
	projectIDStr := chi.URLParam(r, "id")
	projectID, err := uuid.Parse(projectIDStr)

	if err != nil {
		http.Error(w, "Invalid project ID format", http.StatusBadRequest)
		return
	}

	// Получаем панорамы
	panoramas, err := h.repo.GetByProject(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(panoramas)
}
