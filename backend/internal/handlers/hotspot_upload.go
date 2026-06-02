package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type HotspotUploadHandler struct {
	baseDir string
}

func NewHotspotUploadHandler(baseDir string) *HotspotUploadHandler {
	// Создаем корневую папку uploads/projects
	os.MkdirAll(filepath.Join(baseDir, "projects"), 0755)
	return &HotspotUploadHandler{baseDir: baseDir}
}

func (h *HotspotUploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Метод не разрешён")
		return
	}

	// Получаем project_id из формы
	projectIDStr := r.FormValue("project_id")
	if projectIDStr == "" {
		writeError(w, http.StatusBadRequest, "project_id обязателен")
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат project_id")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Файл не найден")
		return
	}
	defer file.Close()

	// Валидация типа файла
	allowedTypes := map[string]bool{
		"image/jpeg":    true,
		"image/jpg":     true,
		"image/png":     true,
		"image/gif":     true,
		"image/svg+xml": true,
	}

	contentType := header.Header.Get("Content-Type")
	if !allowedTypes[contentType] {
		writeError(w, http.StatusBadRequest, "Неподдерживаемый тип файла. Разрешены: JPEG, PNG, GIF, SVG")
		return
	}

	// Ограничение размера (5MB для иконок хотспотов)
	const maxSize = 5 * 1024 * 1024
	limitedFile := io.LimitReader(file, maxSize+1)
	contents, err := io.ReadAll(limitedFile)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка чтения файла")
		return
	}
	if len(contents) > maxSize {
		writeError(w, http.StatusBadRequest, "Файл слишком большой (макс. 5MB)")
		return
	}

	// Генерируем уникальное имя файла
	extension := filepath.Ext(header.Filename)
	newFilename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), extension)

	// Сохраняем в папку projects/{project_id}/hotspots
	fullDir := filepath.Join(h.baseDir, "projects", projectID.String(), "hotspots")
	if err := os.MkdirAll(fullDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка создания директории")
		return
	}

	filePath := filepath.Join(fullDir, newFilename)
	uploadedFile, err := os.Create(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка сохранения файла")
		return
	}
	defer uploadedFile.Close()

	if _, err := uploadedFile.Write(contents); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка записи файла")
		return
	}

	// Возвращаем относительный путь для привязки к проекту
	fileUrl := filepath.Join("projects", projectID.String(), "hotspots", newFilename)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"file_url":  fileUrl,
		"filename":  newFilename,
		"mime_type": contentType,
		"file_size": len(contents),
		"project_id": projectID.String(),
	})
}