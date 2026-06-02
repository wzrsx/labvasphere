// handlers/avatar_handler.go
package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"labvasphere-api/internal/middleware"
	"labvasphere-api/internal/storage/postgres"
)

type AvatarHandler struct {
	userRepo    *postgres.UserRepository
	uploadDir   string
	maxFileSize int64 // 5MB
}

func NewAvatarHandler(userRepo *postgres.UserRepository, baseUploadDir string) *AvatarHandler {
	avatarDir := filepath.Join(baseUploadDir, "avatars")
	_ = os.MkdirAll(avatarDir, 0755)

	return &AvatarHandler{
		userRepo:    userRepo,
		uploadDir:   avatarDir,
		maxFileSize: 5 << 20, // 5MB
	}
}

// UploadAvatar обрабатывает загрузку файла аватара
func (h *AvatarHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	// Проверяем авторизацию
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	// Ограничиваем размер запроса
	r.Body = http.MaxBytesReader(w, r.Body, h.maxFileSize+1<<20)

	// Парсим multipart form (max 10MB)
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, "Ошибка при чтении файла: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, "Файл не найден в запросе", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Валидация типа файла
	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/webp": true,
	}

	fileType := handler.Header.Get("Content-Type")
	if !allowedTypes[fileType] {
		http.Error(w, "Недопустимый формат файла. Разрешены: JPG, PNG, WebP", http.StatusBadRequest)
		return
	}

	// Валидация размера
	if handler.Size > h.maxFileSize {
		http.Error(w, "Файл слишком большой. Максимум 5MB", http.StatusBadRequest)
		return
	}

	// Генерируем уникальное имя файла
	fileExt := filepath.Ext(handler.Filename)
	newFilename := claims.UserID + fileExt
	filePath := filepath.Join(h.uploadDir, newFilename)

	// Создаем файл для записи
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Ошибка при сохранении файла", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Копируем содержимое
	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, "Ошибка при записи файла", http.StatusInternalServerError)
		return
	}

	// Формируем URL для доступа к аватару
	avatarURL := "avatars/" + newFilename

	// Обновляем аватар в БД
	err = h.userRepo.UpdateAvatar(r.Context(), claims.UserID, avatarURL)
	if err != nil {
		// Откат: удаляем файл при ошибке БД
		os.Remove(filePath)
		http.Error(w, "Ошибка при обновлении профиля", http.StatusInternalServerError)
		return
	}

	// Возвращаем ответ
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"message":    "Аватар успешно загружен",
		"avatar_url": avatarURL,
	})
}

// DeleteAvatar удаляет аватар пользователя
func (h *AvatarHandler) DeleteAvatar(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		http.Error(w, "Пользователь не авторизован", http.StatusUnauthorized)
		return
	}

	// Получаем текущего пользователя для получения старого URL
	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil || user == nil {
		http.Error(w, "Пользователь не найден", http.StatusNotFound)
		return
	}

	// Удаляем файл, если он существовал
	if user.AvatarURL != nil && *user.AvatarURL != "" {
		// Извлекаем имя файла из пути
		avatarPath := strings.TrimPrefix(*user.AvatarURL, "avatars/")
		filePath := filepath.Join(h.uploadDir, avatarPath)
		os.Remove(filePath) // Игнорируем ошибку, если файла нет
	}

	// Очищаем поле в БД
	err = h.userRepo.UpdateAvatar(r.Context(), claims.UserID, "")
	if err != nil {
		http.Error(w, "Ошибка при удалении аватара", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Аватар удалён",
	})
}
