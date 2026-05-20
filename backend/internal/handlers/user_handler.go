package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"labvasphere-api/internal/dto"
	"labvasphere-api/internal/middleware"
	"labvasphere-api/internal/storage/postgres"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type UserHandler struct {
	userRepo *postgres.UserRepository
}

func NewUserHandler(userRepo *postgres.UserRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo}
}

// GetProfile получает профиль текущего пользователя
func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil {
		http.Error(w, "Ошибка при получении профиля", http.StatusInternalServerError)
		return
	}
	if user == nil {
		http.Error(w, "Пользователь не найден", http.StatusNotFound)
		return
	}

	resp := &dto.UserProfileResponse{
		ID:        user.ID,
		FullName:  user.FullName,
		Email:     user.Email,
		AvatarURL: user.AvatarURL,
		Bio:       user.Bio,
		Role:      user.Role,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// UpdateProfile обновляет профиль текущего пользователя
func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	var req dto.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	// Валидация ФИО
	if req.FullName == "" {
		http.Error(w, "ФИО обязательно для заполнения", http.StatusBadRequest)
		return
	}

	// Получаем текущего пользователя
	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil {
		http.Error(w, "Ошибка при получении профиля", http.StatusInternalServerError)
		return
	}
	if user == nil {
		http.Error(w, "Пользователь не найден", http.StatusNotFound)
		return
	}

	// Обновляем поля
	user.FullName = req.FullName
	user.AvatarURL = req.AvatarURL
	user.Bio = req.Bio

	err = h.userRepo.Update(user)
	if err != nil {
		http.Error(w, "Ошибка при обновлении профиля", http.StatusInternalServerError)
		return
	}

	resp := &dto.UserProfileResponse{
		ID:        user.ID,
		FullName:  user.FullName,
		Email:     user.Email,
		AvatarURL: user.AvatarURL,
		Bio:       user.Bio,
		Role:      user.Role,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// GetPublicProfile возвращает публичную информацию о пользователе по ID
func (h *UserHandler) GetPublicProfile(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	if userID == "" {
		http.Error(w, "ID пользователя не указан", http.StatusBadRequest)
		return
	}

	// Валидация UUID
	if _, err := uuid.Parse(userID); err != nil {
		http.Error(w, "Неверный формат ID пользователя", http.StatusBadRequest)
		return
	}

	user, err := h.userRepo.GetPublicInfoByID(r.Context(), userID)
	if err != nil {
		log.Printf("ERROR: GetPublicProfile failed: %v", err)
		http.Error(w, "Ошибка при получении данных пользователя", http.StatusInternalServerError)
		return
	}
	if user == nil {
		http.Error(w, "Пользователь не найден", http.StatusNotFound)
		return
	}

	resp := &dto.UserPublicResponse{
		ID:        user.ID,
		FullName:  user.FullName,
		AvatarURL: user.AvatarURL,
		Bio:       user.Bio,
		Role:      user.Role,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
