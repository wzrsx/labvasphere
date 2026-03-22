package email

import (
	"bytes"
	"fmt"
	"net/smtp"
	"os"
	"strconv"
)

type EmailService struct {
	smtpHost  string
	smtpPort  int
	smtpUser  string
	smtpPass  string
	fromEmail string
	fromName  string
}

func NewEmailService() *EmailService {
	return &EmailService{
		smtpHost:  os.Getenv("SMTP_HOST"),
		smtpPort:  getIntEnv("SMTP_PORT", 587),
		smtpUser:  os.Getenv("SMTP_USER"),
		smtpPass:  os.Getenv("SMTP_PASS"),
		fromEmail: os.Getenv("FROM_EMAIL"),
		fromName:  os.Getenv("FROM_NAME"),
	}
}

func getIntEnv(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	result, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return result
}

// SendPasswordReset отправляет письмо с новым паролем через net/smtp
func (s *EmailService) SendPasswordReset(toEmail, fullName, newPassword string) error {
	// Формируем HTML-тело письма
	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 500px; margin: 0 auto; padding: 20px; }
		.header { background: #4a7c9e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
		.content { background: #f9f9f9; padding: 25px; border-radius: 0 0 8px 8px; }
		.password-box { 
			background: #fff; 
			border: 2px dashed #4a7c9e; 
			padding: 15px; 
			margin: 20px 0; 
			text-align: center; 
			font-size: 18px; 
			font-weight: bold;
			letter-spacing: 2px;
		}
		.warning { 
			background: #fff3cd; 
			border-left: 4px solid #ffc107; 
			padding: 12px; 
			margin: 20px 0; 
			font-size: 13px; 
		}
		.footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h2>🔐 LabvaSphere</h2>
		</div>
		<div class="content">
			<p>Здравствуйте, <strong>%s</strong>!</p>
			<p>Вы запросили восстановление пароля. Ваш новый временный пароль:</p>
			
			<div class="password-box">%s</div>
			
			<div class="warning">
				⚠️ <strong>Важно:</strong> Этот пароль действителен только для одного входа. 
				После авторизации обязательно смените его в настройках профиля.
			</div>
			
			<p>Если вы не запрашивали восстановление — проигнорируйте это письмо.</p>
			
			<div class="footer">
				<p>© 2024 LabvaSphere. Все права защищены.</p>
			</div>
		</div>
	</div>
</body>
</html>`, fullName, newPassword)

	// Формируем заголовки и тело письма в формате MIME
	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("From: %s <%s>\r\n", s.fromName, s.fromEmail))
	buf.WriteString(fmt.Sprintf("To: %s\r\n", toEmail))
	buf.WriteString("Subject: Восстановление пароля - LabvaSphere\r\n")
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	buf.WriteString("Content-Transfer-Encoding: quoted-printable\r\n")
	buf.WriteString("\r\n")
	buf.WriteString(htmlBody)

	// Адрес для подключения (хост:порт)
	addr := fmt.Sprintf("%s:%d", s.smtpHost, s.smtpPort)

	// Аутентификация
	var auth smtp.Auth
	if s.smtpUser != "" && s.smtpPass != "" {
		auth = smtp.PlainAuth("", s.smtpUser, s.smtpPass, s.smtpHost)
	}

	// Отправка письма
	// Используем SendMail с явной аутентификацией
	// Если аутентификация не нужна (локальный сервер), передаём nil
	if auth != nil {
		return smtp.SendMail(addr, auth, s.fromEmail, []string{toEmail}, buf.Bytes())
	}
	return smtp.SendMail(addr, nil, s.fromEmail, []string{toEmail}, buf.Bytes())
}
