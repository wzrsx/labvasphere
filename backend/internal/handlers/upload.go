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

type UploadHandler struct {
	uploadDir string
}

func NewUploadHandler(uploadDir string) *UploadHandler {
	// Создаём директорию для загрузок, если её нет
	os.MkdirAll(uploadDir, 0755)

	return &UploadHandler{
		uploadDir: uploadDir,
	}
}

// UploadFile загружает файл на сервер
func (h *UploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	// Проверяем метод
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Метод не разрешён")
		return
	}

	// Получаем файл из формы
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Файл не найден")
		return
	}
	defer file.Close()

	// Проверяем тип файла
	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
	}

	if !allowedTypes[header.Header.Get("Content-Type")] {
		writeError(w, http.StatusBadRequest, "Неподдерживаемый тип файла. Разрешены: JPG, PNG")
		return
	}

	// Проверяем размер файла (максимум 50 МБ)
	const maxSize = 50 * 1024 * 1024 // 50 МБ
	// Создаем временный буфер для проверки размера
	limitedFile := io.LimitReader(file, maxSize+1)

	// Читаем содержимое файла
	contents, err := io.ReadAll(limitedFile)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка чтения файла")
		return
	}

	if len(contents) > maxSize {
		writeError(w, http.StatusBadRequest, "Файл слишком большой. Максимальный размер: 50 МБ")
		return
	}

	// Генерируем уникальное имя файла
	extension := filepath.Ext(header.Filename)
	newFilename := fmt.Sprintf("%s_%d%s",
		uuid.New().String(),
		time.Now().Unix(),
		extension,
	)

	// Создаем путь к файлу
	filePath := filepath.Join(h.uploadDir, newFilename)

	// Сохраняем файл
	uploadedFile, err := os.Create(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка сохранения файла")
		return
	}
	defer uploadedFile.Close()

	// Записываем содержимое
	_, err = uploadedFile.Write(contents)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка записи файла")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "Файл успешно загружен",
		"file_url": newFilename, // ← Только имя файла: "filename.png"
		"filename": newFilename,
	})
}
