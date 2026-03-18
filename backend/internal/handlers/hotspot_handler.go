package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"labvasphere-api/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// 🔹 Интерфейс репозитория (только методы, без полей!)
type HotspotRepository interface {
	Create(ctx context.Context, req models.HotspotRequest) (*models.HotspotResponse, error)
	Update(ctx context.Context, id uuid.UUID, req models.HotspotRequest) (*models.HotspotResponse, error)
	GetByPanorama(ctx context.Context, panoramaID uuid.UUID) ([]models.HotspotResponse, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type HotspotHandler struct {
	repo HotspotRepository // ← интерфейс, не указатель
}

func NewHotspotHandler(repo HotspotRepository) *HotspotHandler {
	return &HotspotHandler{repo: repo}
}

func (h *HotspotHandler) RegisterRoutes(r chi.Router) {
	r.Post("/", h.Create)
	r.Get("/panorama/{panorama_id}", h.GetByPanorama)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
}

func (h *HotspotHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.HotspotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат запроса: "+err.Error())
		return
	}

	// Валидация
	if req.TargetType == "panorama" && req.TargetPanoramaID == nil {
		writeError(w, http.StatusBadRequest, "target_panorama_id обязателен для типа 'panorama'")
		return
	}

	resp, err := h.repo.Create(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка сохранения хотспота: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *HotspotHandler) GetByPanorama(w http.ResponseWriter, r *http.Request) {
	panoramaID, err := uuid.Parse(chi.URLParam(r, "panorama_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный ID панорамы")
		return
	}

	hotspots, err := h.repo.GetByPanorama(r.Context(), panoramaID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка получения хотспотов")
		return
	}

	writeJSON(w, http.StatusOK, hotspots)
}

func (h *HotspotHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный ID хотспота")
		return
	}

	var req models.HotspotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}

	resp, err := h.repo.Update(r.Context(), id, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка обновления хотспота")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *HotspotHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный ID хотспота")
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка удаления хотспота")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
