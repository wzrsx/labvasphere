package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"labvasphere-api/internal/middleware"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

type UserSettingsRepository interface {
	GetByUserID(ctx context.Context, userID string) (map[string]interface{}, error)
	Upsert(ctx context.Context, userID string, preferences map[string]interface{}) error
}

func (h *UserSettingsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.Get)      // GET /api/v1/user/settings
	r.Patch("/", h.Update) // PATCH /api/v1/user/settings
}

type UserSettingsHandler struct {
	repo UserSettingsRepository
}

func NewUserSettingsHandler(repo UserSettingsRepository) *UserSettingsHandler {
	return &UserSettingsHandler{repo: repo}
}

// Get возвращает настройки текущего пользователя
func (h *UserSettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	// 🔹 Получаем пользователя через ваш middleware
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		log.Printf("[ERROR] Get user settings: user not found in context")
		writeError(w, http.StatusUnauthorized, "Требуется авторизация")
		return
	}

	userID := claims.UserID // ← поправьте, если поле называется иначе: claims.ID / claims.UserUUID и т.д.
	log.Printf("[DEBUG] Get user settings: user_id=%s", userID)

	settings, err := h.repo.GetByUserID(r.Context(), userID)
	if err != nil {
		log.Printf("[ERROR] Repo.GetByUserID failed: %v, user_id=%s", err, userID)
		writeError(w, http.StatusInternalServerError, "Ошибка получения настроек")
		return
	}

	// Если настроек нет — возвращаем дефолтные
	if settings == nil {
		settings = map[string]interface{}{
			"default_icon":  "pin",
			"default_color": "#99582A",
		}
	}

	elapsed := time.Since(start)
	log.Printf("[INFO] Get user settings completed: user_id=%s, duration=%v", userID, elapsed)
	writeJSON(w, http.StatusOK, settings)
}

// Update обновляет настройки текущего пользователя (merge, не полная замена)
func (h *UserSettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	// 🔹 Получаем пользователя через ваш middleware
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		log.Printf("[ERROR] Update user settings: user not found in context")
		writeError(w, http.StatusUnauthorized, "Требуется авторизация")
		return
	}

	userID := claims.UserID // ← поправьте, если поле называется иначе
	log.Printf("[DEBUG] Update user settings: method=%s, user_id=%s", r.Method, userID)

	// Чтение тела запроса
	var newPrefs map[string]interface{}
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[ERROR] Read request body failed: %v", err)
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	bodyPreview := string(bodyBytes)
	if len(bodyPreview) > 500 {
		bodyPreview = bodyPreview[:500] + "..."
	}
	log.Printf("[DEBUG] Request body: %s", bodyPreview)

	if err := json.NewDecoder(r.Body).Decode(&newPrefs); err != nil {
		log.Printf("[ERROR] Decode JSON failed: %v", err)
		writeError(w, http.StatusBadRequest, "Неверный формат JSON")
		return
	}
	log.Printf("[DEBUG] Decoded preferences: %+v", newPrefs)

	// Валидация ключевых полей (опционально)
	if icon, ok := newPrefs["default_icon"].(string); ok {
		allowed := map[string]bool{"pin": true, "dot": true, "star": true, "camera": true}
		if icon != "" && !allowed[icon] {
			log.Printf("[ERROR] Invalid default_icon: %q", icon)
			writeError(w, http.StatusBadRequest, "Недопустимое значение default_icon")
			return
		}
	}

	// Сохранение (upsert: создаст или обновит)
	if err := h.repo.Upsert(r.Context(), userID, newPrefs); err != nil {
		log.Printf("[ERROR] Repo.Upsert failed: %v, user_id=%s", err, userID)
		writeError(w, http.StatusInternalServerError, "Ошибка сохранения настроек")
		return
	}

	// Возвращаем обновлённые настройки
	updated, _ := h.repo.GetByUserID(r.Context(), userID)

	elapsed := time.Since(start)
	log.Printf("[INFO] Update user settings completed: user_id=%s, duration=%v", userID, elapsed)
	writeJSON(w, http.StatusOK, updated)
}
