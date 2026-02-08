package handlers

import (
	"encoding/json"
	"net/http"
	"os"

	"labvasphere-api/internal/models"
	"labvasphere-api/internal/security"
	"labvasphere-api/internal/storage/postgres"
)

type AuthHandler struct {
	userRepo  *postgres.UserRepository
	jwtSecret string
}

func NewAuthHandler(userRepo *postgres.UserRepository) *AuthHandler {
	return &AuthHandler{
		userRepo:  userRepo,
		jwtSecret: os.Getenv("JWT_SECRET"),
	}
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
