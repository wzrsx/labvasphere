package handlers

import (
	"fmt"
	"io"
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
	os.MkdirAll(filepath.Join(baseDir, "panoramas"), 0755)
	return &PanoramaUploadHandler{baseDir: baseDir}
}

func (h *PanoramaUploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Метод не разрешён")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Файл не найден")
		return
	}
	defer file.Close()

	fileUrl, err := saveUploadedFile(file, header, h.baseDir, "panoramas")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "Панорама загружена",
		"file_url": filepath.Base(fileUrl),
		"filename": filepath.Base(fileUrl),
	})
}

// Вспомогательная функция (можно вынести в utils.go)
func saveUploadedFile(file io.Reader, header *multipart.FileHeader, baseDir string, subDir string) (string, error) {
	fullDir := filepath.Join(baseDir, subDir)
	os.MkdirAll(fullDir, 0755)

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

	_, err = uploadedFile.Write(contents)
	if err != nil {
		return "", err
	}

	return filepath.Join(subDir, newFilename), nil
}
