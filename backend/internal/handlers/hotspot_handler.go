package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

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
	start := time.Now()

	// 🔹 Вход в хендлер
	log.Printf("[DEBUG] Update hotspot: method=%s, path=%s", r.Method, r.URL.Path)

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		log.Printf("[ERROR] Parse UUID failed: %v, raw=%q", err, chi.URLParam(r, "id"))
		writeError(w, http.StatusBadRequest, "Неверный ID хотспота")
		return
	}
	log.Printf("[DEBUG] Parsed hotspot ID: %s", id)

	// 🔹 Чтение и логирование тела запроса
	var req models.HotspotRequest
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[ERROR] Read request body failed: %v", err)
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes)) // Восстанавливаем body для декодера

	// Логируем тело (обрезаем до 500 символов, чтобы не засорять лог)
	bodyPreview := string(bodyBytes)
	if len(bodyPreview) > 500 {
		bodyPreview = bodyPreview[:500] + "..."
	}
	log.Printf("[DEBUG] Request body: %s", bodyPreview)

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[ERROR] Decode JSON failed: %v", err)
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}
	log.Printf("[DEBUG] Decoded request: %+v", req)

	// 🔹 Вызов репозитория
	log.Printf("[DEBUG] Calling repo.Update for id=%s", id)
	resp, err := h.repo.Update(r.Context(), id, req)
	if err != nil {
		log.Printf("[ERROR] Repo.Update failed: %v, id=%s, req=%+v", err, id, req)
		writeError(w, http.StatusInternalServerError, "Ошибка обновления хотспота")
		return
	}
	log.Printf("[DEBUG] Repo.Update success, response: %+v", resp)

	// 🔹 Успешный ответ
	elapsed := time.Since(start)
	log.Printf("[INFO] Update hotspot completed: id=%s, status=200, duration=%v", id, elapsed)
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

func (h *HotspotHandler) ListByPanoramaPublic(w http.ResponseWriter, r *http.Request) {
	panoramaIDStr := chi.URLParam(r, "id")

	// 🔹 Парсим string → uuid.UUID
	panoramaID, err := uuid.Parse(panoramaIDStr)
	if err != nil {
		http.Error(w, "Invalid panorama ID format", http.StatusBadRequest)
		return
	}

	hotspots, err := h.repo.GetByPanorama(r.Context(), panoramaID)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hotspots)
}
