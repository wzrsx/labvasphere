package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"labvasphere-api/internal/security"

	"github.com/golang-jwt/jwt/v5"
)

// OptionalAuth — middleware для опциональной авторизации
func OptionalAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")

		// Нет токена → просто вызываем следующий хендлер
		if authHeader == "" {
			next(w, r)
			return
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			next(w, r)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// 🔹 ИСПРАВЛЕНИЕ 1: указатель на Claims (чтобы jwt.ParseWithClaims мог записать данные)
		claims := &security.Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		// Невалидный токен → продолжаем без пользователя (это опциональная авторизация!)
		if err != nil || !token.Valid {
			next(w, r)
			return
		}

		// 🔹 ИСПРАВЛЕНИЕ 2: кладём ВЕСЬ объект *claims по ключу userContextKey
		// userContextKey уже объявлен в этом пакете — используем его напрямую!
		// НЕ claims.UserID, НЕ "user_id" — а именно *claims
		ctx := context.WithValue(r.Context(), userContextKey, claims)

		next(w, r.WithContext(ctx))
	}
}
