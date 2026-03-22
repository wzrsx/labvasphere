package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"labvasphere-api/internal/email"
	"labvasphere-api/internal/models"
	"labvasphere-api/internal/security"
	"labvasphere-api/internal/storage/postgres"
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
}

// LoginRequest - запрос входа
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
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
		req.Role = "user" // по умолчанию
	}

	// Создаем пользователя
	user := &models.User{
		FullName: req.FullName,
		Email:    req.Email,
		Password: req.Password,
		Role:     req.Role,
	}

	err := h.userRepo.CreateUser(user)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	// Генерируем токен
	token, err := security.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка генерации токена")
		return
	}

	// Очищаем пароль из ответа
	user.Password = ""
	user.PasswordHash = ""

	response := AuthResponse{
		Token: token,
		User:  user,
	}

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
