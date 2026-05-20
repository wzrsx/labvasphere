// cmd/server/main.go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"labvasphere-api/internal/config"
	"labvasphere-api/internal/email"
	"labvasphere-api/internal/handlers"
	"labvasphere-api/internal/middleware"
	"labvasphere-api/internal/storage/postgres"
)

func main() {
	// Загружаем .env (только в dev!)
	if os.Getenv("ENV") != "production" {
		if err := godotenv.Load(); err != nil {
			log.Println("No .env file found")
		}
	}

	cfg := config.MustLoad()

	// Подключаемся к БД
	db, err := postgres.NewDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Репозитории
	userRepo := postgres.NewUserRepository(db)
	projectRepo := postgres.NewProjectRepository(db)
	hotspotRepo := postgres.NewHotspotRepository(db)
	panoramaRepo := postgres.NewPanoramaRepository(db)
	partnerRepo := postgres.NewPartnerRepository(db)
	// Хендлеры
	emailService := email.NewEmailService()
	authHandler := handlers.NewAuthHandler(userRepo, emailService)
	panoramaUploadHandler := handlers.NewPanoramaUploadHandler("./uploads")
	coverHandler := handlers.NewCoverUploadHandler("./uploads")
	projectHandler := handlers.NewProjectHandler(projectRepo, panoramaRepo, "./uploads")
	panoramaHandler := handlers.NewPanoramaHandler(panoramaRepo)
	userHandler := handlers.NewUserHandler(userRepo)
	hotspotHandler := handlers.NewHotspotHandler(hotspotRepo)
	hotspotUploadHandler := handlers.NewHotspotUploadHandler("./uploads")
	partnerHandler := handlers.NewPartnerHandler(partnerRepo)
	avatarHandler := handlers.NewAvatarHandler(userRepo, "./uploads")

	// Настраиваем роутер
	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.Timeout(60 * time.Second))

	// CORS
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: false,
	})
	r.Use(corsMiddleware.Handler)

	r.Handle("/uploads/projects/*", http.StripPrefix("/uploads/projects/",
		http.FileServer(http.Dir("./uploads/projects"))))
	r.Handle("/uploads/avatars/*", http.StripPrefix("/uploads/avatars/",
		http.FileServer(http.Dir("./uploads/avatars"))))
	// Роуты
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		})
		// Роуты аутентификации
		r.Route("/auth", func(r chi.Router) {
			// Публичные (без middleware)
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
			r.Post("/reset-password", authHandler.ResetPassword)

			// Защищённые (с middleware через r.With())
			r.With(middleware.AuthMiddleware).Post("/change-password", authHandler.ChangePassword)
			r.With(middleware.AuthMiddleware).Post("/logout", authHandler.Logout)
		})

		// Загрузка файлов (требует аутентификации)
		r.Route("/upload", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			r.Post("/panorama", panoramaUploadHandler.UploadFile)
			r.Post("/cover", coverHandler.UploadFile)
			r.Post("/hotspot", hotspotUploadHandler.UploadFile)
			r.Post("/avatar", avatarHandler.UploadAvatar)
			r.Delete("/avatar", avatarHandler.DeleteAvatar)
		})
		r.Get("/projects/public/{id}", projectHandler.GetPublicProject)

		r.Get("/panoramas/project/{id}", panoramaHandler.ListByProjectPublic)
		r.Get("/hotspots/panorama/{id}", hotspotHandler.ListByPanoramaPublic)
		r.Route("/projects", func(r chi.Router) {
			// ✅ Опциональная авторизация: токен есть → пользователь, нет → аноним
			r.Get("/{id}/like/status", middleware.OptionalAuth(projectHandler.GetLikeStatus))
			// === ПУБЛИЧНЫЕ МАРШРУТЫ (без авторизации) ===
			r.Get("/published", projectHandler.ListPublished)
			r.Get("/public/{id}", projectHandler.GetPublicProject)
			r.Put("/{id}/views", projectHandler.IncrementViews)

			// === ПРИВАТНЫЕ МАРШРУТЫ (требуют авторизации) ===
			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware) // ← 🔐 Только для этой группы

				r.Get("/", projectHandler.List)
				r.Post("/", projectHandler.CreateProject)
				r.Get("/{id}", projectHandler.GetByID)
				r.Put("/{id}", projectHandler.UpdateProject)
				r.Delete("/{id}", projectHandler.DeleteProject)
				r.Put("/{id}/like", projectHandler.LikeProject) // ← PUT, с auth
			})
		})
		// Роуты профиля (требуют аутентификации)
		r.Route("/profile", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			r.Get("/", userHandler.GetProfile)
			r.Put("/", userHandler.UpdateProfile)
		})
		// Публичные роуты пользователя
		r.Route("/users", func(r chi.Router) {
			// Публичный просмотр профиля по ID: GET /users/{id}
			r.Get("/{id}", userHandler.GetPublicProfile)
		})
		// Роуты хотспотов
		r.Route("/hotspots", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			hotspotHandler.RegisterRoutes(r)
		})
		r.Route("/panoramas", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			panoramaHandler.RegisterRoutes(r)
		})
		r.Route("/partner", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			r.Get("/stats", partnerHandler.GetStats)
			r.Get("/link", partnerHandler.GetReferralLink)
			r.Post("/withdraw", partnerHandler.CreateWithdrawal)
			r.Get("/transactions", partnerHandler.GetTransactions)
			r.Get("/referrals", partnerHandler.GetReferrals)
		})
	})

	port := cfg.Port
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Server starting on port %s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Ожидаем SIGINT или SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}
