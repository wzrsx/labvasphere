package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"labvasphere-api/internal/email"
	"labvasphere-api/internal/middleware"
	"labvasphere-api/internal/models"
	"labvasphere-api/internal/security"
	"labvasphere-api/internal/storage/postgres"
	"labvasphere-api/internal/validators"

	"github.com/google/uuid"
)

type AuthHandler struct {
	userRepo     *postgres.UserRepository
	emailService *email.EmailService
	jwtSecret    string
}

func NewAuthHandler(userRepo *postgres.UserRepository, emailService *email.EmailService) *AuthHandler {
	return &AuthHandler{
		userRepo:     userRepo,
		emailService: emailService,
		jwtSecret:    os.Getenv("JWT_SECRET"),
	}
}

// ResetPasswordRequest - запрос на сброс пароля
type ResetPasswordRequest struct {
	Email string `json:"email"`
}

// AuthResponse - ответ аутентификации
type AuthResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// RegisterRequest - запрос регистрации
type RegisterRequest struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"` // "user" или "designer"
	RefCode  string `json:"ref_code,omitempty"`
}

// LoginRequest - запрос входа
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// ChangePasswordRequest - запрос на смену пароля
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// Register обрабатывает регистрацию
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}

	// Валидация роли
	if req.Role != "user" && req.Role != "designer" {
		req.Role = "user"
	}

	// Валидация реферального кода (если есть)
	var refUUID *uuid.UUID
	if req.RefCode != "" {
		parsed, err := uuid.Parse(req.RefCode)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Неверный формат реферального кода")
			return
		}
		refUUID = &parsed
	}

	// Создаём пользователя
	user := &models.User{
		FullName: req.FullName,
		Email:    req.Email,
		Password: req.Password,
		Role:     req.Role,
	}

	// 👇 Используем транзакцию: пользователь + рефералы
	err := h.userRepo.CreateUserWithReferral(r.Context(), user, refUUID)
	if err != nil {
		// Различаем ошибки: пользователь уже есть / реферал не найден
		if errors.Is(err, postgres.ErrUserExists) {
			writeError(w, http.StatusConflict, "Пользователь с таким email уже зарегистрирован")
			return
		}
		if errors.Is(err, postgres.ErrReferrerNotFound) {
			// Реферал не найден — регистрируем пользователя, но без привязки
			// (или можно отклонить регистрацию — по желанию)
			log.Printf("Referrer %s not found, registering user %s without referral", req.RefCode, user.Email)
			// Пробуем создать без реферала
			if err := h.userRepo.CreateUser(user); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
		} else {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	// Генерируем токен
	token, err := security.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка генерации токена")
		return
	}

	// Очищаем чувствительные данные
	user.Password = ""
	user.PasswordHash = ""

	response := AuthResponse{Token: token, User: user}
	writeJSON(w, http.StatusCreated, response)
}

// Login обрабатывает вход
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}

	user, err := h.userRepo.VerifyPassword(req.Email, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Неверный email или пароль")
		return
	}

	// Генерируем токен
	token, err := security.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка генерации токена")
		return
	}

	response := AuthResponse{
		Token: token,
		User:  user,
	}

	writeJSON(w, http.StatusOK, response)
}

// ResetPassword обрабатывает запрос на восстановление пароля
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}

	user, err := h.userRepo.GetUserByEmail(req.Email)
	if err != nil {
		// Для безопасности не раскрываем, что пользователь не найден
		writeJSON(w, http.StatusOK, map[string]string{
			"message": "Если пользователь с таким email существует, инструкции отправлены",
		})
		return
	}

	// Генерируем новый временный пароль
	newPassword, err := security.GenerateSecurePassword(12)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка генерации пароля")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	if err := h.userRepo.UpdatePassword(ctx, user.ID, newPassword); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка обновления пароля")
		return
	}

	go func() {
		if err := h.emailService.SendPasswordReset(user.Email, user.FullName, newPassword); err != nil {
			fmt.Printf("Ошибка отправки письма: %v\n", err)
		}
	}()

	// Возвращаем ответ пользователю
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Если пользователь с таким email существует, инструкции отправлены",
	})
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	// ✅ Правильное получение claims из контекста
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "Требуется авторизация")
		return
	}

	userID := claims.UserID // ← Берём из claims

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат запроса")
		return
	}

	// Валидация нового пароля
	if err := validators.ValidatePassword(req.NewPassword); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Получаем пользователя для проверки текущего пароля
	user, err := h.userRepo.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Пользователь не найден")
		return
	}

	// Проверяем текущий пароль
	if !security.CheckPasswordHash(req.CurrentPassword, user.PasswordHash) {
		writeError(w, http.StatusBadRequest, "Неверный текущий пароль")
		return
	}

	// Обновляем пароль (передаём новый пароль, а не хэш)
	if err := h.userRepo.UpdatePassword(r.Context(), userID, req.NewPassword); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка обновления пароля")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Пароль успешно изменён",
	})
}

// Logout обрабатывает выход
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Выход выполнен"})
}

// Методы для отправки ответов
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
