package validators

import (
	"errors"
	"regexp"
	"unicode"
)

// ValidatePassword проверяет требования к паролю
func ValidatePassword(password string) error {
	if len(password) < 8 {
		return errors.New("Пароль должен содержать минимум 8 символов")
	}

	hasUpper := false
	hasLower := false
	hasSpecial := false

	for _, ch := range password {
		switch {
		case unicode.IsUpper(ch):
			hasUpper = true
		case unicode.IsLower(ch):
			hasLower = true
		case unicode.IsPunct(ch) || unicode.IsSymbol(ch):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return errors.New("Пароль должен содержать хотя бы одну заглавную букву")
	}
	if !hasLower {
		return errors.New("Пароль должен содержать хотя бы одну строчную букву")
	}
	if !hasSpecial {
		return errors.New("Пароль должен содержать хотя бы один спецсимвол")
	}

	// Дополнительная проверка с регулярным выражением
	specialCharRegex := regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`)
	if !specialCharRegex.MatchString(password) {
		return errors.New("Пароль должен содержать хотя бы один спецсимвол")
	}

	return nil
}
