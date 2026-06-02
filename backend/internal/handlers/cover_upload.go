// internal/handlers/cover_upload.go
package handlers

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

type CoverUploadHandler struct {
	baseDir string
}

func NewCoverUploadHandler(baseDir string) *CoverUploadHandler {
	os.MkdirAll(filepath.Join(baseDir, "projects"), 0755)
	return &CoverUploadHandler{baseDir: baseDir}
}

func (h *CoverUploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Метод не разрешён")
		return
	}

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

	fileUrl, err := saveCoverFile(file, header, h.baseDir, projectID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "Обложка загружена",
		"file_url": fileUrl, // "projects/{uuid}/cover_image.jpg"
		"filename": "cover_image.jpg",
	})
}

func saveCoverFile(file io.Reader, header *multipart.FileHeader, baseDir string, projectID uuid.UUID) (string, error) {
	// Путь: ./uploads/projects/{uuid}/
	projectDir := filepath.Join(baseDir, "projects", projectID.String())
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create project directory: %w", err)
	}

	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
	}
	if !allowedTypes[header.Header.Get("Content-Type")] {
		return "", fmt.Errorf("неподдерживаемый тип файла")
	}

	// Фиксированное имя: cover_image.jpg
	filename := "cover_image.jpg"
	filePath := filepath.Join(projectDir, filename)

	uploadedFile, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer uploadedFile.Close()

	limitedFile := io.LimitReader(file, 10*1024*1024)
	_, err = io.Copy(uploadedFile, limitedFile)
	if err != nil {
		return "", err
	}

	// Возвращаем относительный путь
	return filepath.Join("projects", projectID.String(), filename), nil
}
