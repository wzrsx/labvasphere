package handlers

import (
	"net/http"
	"os"
	"path/filepath"
)

type CoverUploadHandler struct {
	baseDir string
}

func NewCoverUploadHandler(baseDir string) *CoverUploadHandler {
	os.MkdirAll(filepath.Join(baseDir, "covers"), 0755)
	return &CoverUploadHandler{baseDir: baseDir}
}

func (h *CoverUploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
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

	fileUrl, err := saveUploadedFile(file, header, h.baseDir, "covers")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "Обложка загружена",
		"file_url": filepath.Base(fileUrl),
		"filename": filepath.Base(fileUrl),
	})
}
