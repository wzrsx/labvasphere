package security

import (
	"crypto/rand"
	"math/big"
)

const passwordChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"

// GenerateSecurePassword генерирует случайный пароль заданной длины
func GenerateSecurePassword(length int) (string, error) {
	if length < 8 {
		length = 8
	}

	result := make([]byte, length)
	max := big.NewInt(int64(len(passwordChars)))

	for i := range result {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		result[i] = passwordChars[n.Int64()]
	}

	return string(result), nil
}
