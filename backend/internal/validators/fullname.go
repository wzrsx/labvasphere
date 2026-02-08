package validators

import (
	"errors"
	"regexp"
	"strings"
)

// ValidateFullName проверяет ФИО с помощью регулярных выражений:
func ValidateFullName(fullName string) error {
	trimmed := strings.TrimSpace(fullName)

	// Проверка на пустоту
	if trimmed == "" {
		return errors.New("ФИО не может быть пустым")
	}

	// Регулярное выражение для проверки символов:
	// Разрешены только буквы (русские и английские), пробелы и дефисы
	allowedCharsRegex := regexp.MustCompile(`^[а-яА-ЯёЁa-zA-Z\s-]+$`)
	if !allowedCharsRegex.MatchString(trimmed) {
		return errors.New("ФИО должно содержать только буквы, пробелы и дефисы")
	}

	// Проверка на слишком длинное ФИО
	if len(trimmed) > 200 {
		return errors.New("ФИО не должно превышать 200 символов")
	}

	// Проверка на множественные пробелы подряд
	multipleSpacesRegex := regexp.MustCompile(`\s{2,}`)
	if multipleSpacesRegex.MatchString(trimmed) {
		return errors.New("ФИО не должно содержать множественные пробелы подряд")
	}

	// Проверка на дефисы в начале или конце слова
	invalidDashRegex := regexp.MustCompile(`(^-|-$|-\s|\s-|--)`)
	if invalidDashRegex.MatchString(trimmed) {
		return errors.New("Дефисы должны находиться только внутри слов")
	}

	return nil
}
