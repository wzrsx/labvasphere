// internal/handlers/panorama_upload.go
package handlers

import (
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type PanoramaUploadHandler struct {
	baseDir string
}

func NewPanoramaUploadHandler(baseDir string) *PanoramaUploadHandler {
	os.MkdirAll(filepath.Join(baseDir, "projects"), 0755)
	return &PanoramaUploadHandler{baseDir: baseDir}
}

func (h *PanoramaUploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
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

	// Сохраняем файл
	fileUrl, err := saveUploadedFile(file, header, h.baseDir, projectID, "panoramas")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	log.Printf("DEBUG: File saved: %s", fileUrl)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "Панорама загружена",
		"file_url": fileUrl,
		"filename": filepath.Base(fileUrl),
	})
}

func saveUploadedFile(file io.Reader, header *multipart.FileHeader, baseDir string, projectID uuid.UUID, subDir string) (string, error) {
	fullDir := filepath.Join(baseDir, "projects", projectID.String(), subDir)
	if err := os.MkdirAll(fullDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
	}
	if !allowedTypes[header.Header.Get("Content-Type")] {
		return "", fmt.Errorf("неподдерживаемый тип файла")
	}

	const maxSize = 50 * 1024 * 1024
	limitedFile := io.LimitReader(file, maxSize+1)
	contents, err := io.ReadAll(limitedFile)
	if err != nil {
		return "", err
	}
	if len(contents) > maxSize {
		return "", fmt.Errorf("файл слишком большой")
	}

	extension := filepath.Ext(header.Filename)
	newFilename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), extension)
	filePath := filepath.Join(fullDir, newFilename)

	uploadedFile, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer uploadedFile.Close()

	if _, err := uploadedFile.Write(contents); err != nil {
		return "", err
	}

	// Возвращаем относительный путь: "projects/{uuid}/panoramas/file.jpg"
	return filepath.Join("projects", projectID.String(), subDir, newFilename), nil
}
