package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"labvasphere-api/internal/security"
)

// contextKey — уникальный тип для ключа контекста
type contextKey string

const (
	userContextKey contextKey = "user"
)

// AuthMiddleware проверяет наличие и валидность JWT токена
// и сохраняет данные пользователя в контексте запроса
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Получаем токен из заголовка Authorization
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			writeError(w, http.StatusUnauthorized, "Токен не предоставлен")
			return
		}

		// Формат: "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			writeError(w, http.StatusUnauthorized, "Неверный формат токена")
			return
		}

		tokenString := parts[1]

		// Валидируем токен
		claims, err := security.ValidateToken(tokenString)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Неверный или просроченный токен")
			return
		}

		// Сохраняем данные пользователя в контексте запроса
		ctx := context.WithValue(r.Context(), userContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUserFromContext извлекает данные пользователя из контекста
func GetUserFromContext(ctx context.Context) *security.Claims {
	user, ok := ctx.Value(userContextKey).(*security.Claims)
	if !ok {
		return nil
	}
	return user
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
