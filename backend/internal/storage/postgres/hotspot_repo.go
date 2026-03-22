package postgres

import (
	"context"
	"fmt"
	"labvasphere-api/internal/models"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// 🔹 Структура репозитория (не интерфейс!)
type HotspotRepository struct {
	pool *pgxpool.Pool
}

// 🔹 Конструктор возвращает структуру
func NewHotspotRepository(pool *pgxpool.Pool) *HotspotRepository {
	return &HotspotRepository{pool: pool}
}

func (r *HotspotRepository) Create(ctx context.Context, req models.HotspotRequest) (*models.HotspotResponse, error) {
	id := uuid.New()
	now := time.Now()

	query := `
		INSERT INTO hotspots (
			id, panorama_id, position_yaw, position_pitch,
			target_type, target_panorama_id, target_filename,
			title, tooltip, content_text, media_url, external_url,
			icon, color, sort_order, is_active, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
		) RETURNING id, created_at, updated_at
	`

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	var createdAt, updatedAt time.Time

	err := r.pool.QueryRow(ctx, query,
		id,                   // $1
		req.PanoramaID,       // $2
		req.PositionYaw,      // $3
		req.PositionPitch,    // $4
		req.TargetType,       // $5
		req.TargetPanoramaID, // $6
		req.TargetFilename,   // $7
		req.Title,            // $8
		req.Tooltip,          // $9
		req.ContentText,      // $10
		req.MediaURL,         // $11
		req.ExternalURL,      // $12
		req.Icon,             // $13
		req.Color,            // $14
		sortOrder,            // $15
		isActive,             // $16
		now,                  // $17
		now,                  // $18
	).Scan(&id, &createdAt, &updatedAt)

	if err != nil {
		log.Printf("ERROR: INSERT failed: %v", err)
		return nil, fmt.Errorf("failed to create hotspot: %w", err)
	}

	return &models.HotspotResponse{
		ID:               id,
		PanoramaID:       req.PanoramaID,
		PositionYaw:      req.PositionYaw,
		PositionPitch:    req.PositionPitch,
		TargetType:       req.TargetType,
		TargetPanoramaID: req.TargetPanoramaID,
		TargetFilename:   req.TargetFilename,
		Title:            req.Title,
		Tooltip:          req.Tooltip,
		Icon:             req.Icon,
		Color:            req.Color,
		SortOrder:        sortOrder,
		IsActive:         isActive,
		CreatedAt:        createdAt.Format(time.RFC3339),
		UpdatedAt:        updatedAt.Format(time.RFC3339),
	}, nil
}

func (r *HotspotRepository) Update(ctx context.Context, id uuid.UUID, req models.HotspotRequest) (*models.HotspotResponse, error) {
	now := time.Now()

	query := `
		UPDATE hotspots SET
			position_yaw = $1, position_pitch = $2,
			target_type = $3, target_panorama_id = $4, target_filename = $5,
			title = $6, tooltip = $7, content_text = $8, media_url = $9, external_url = $10,
			icon = $11, color = $12, sort_order = $13, is_active = $14, updated_at = $15
		WHERE id = $16
		RETURNING panorama_id, created_at, updated_at
	`

	var panoramaID uuid.UUID
	var createdAt time.Time

	err := r.pool.QueryRow(ctx, query,
		req.PositionYaw, req.PositionPitch,
		req.TargetType, req.TargetPanoramaID, req.TargetFilename,
		req.Title, req.Tooltip, req.ContentText, req.MediaURL, req.ExternalURL,
		req.Icon, req.Color,
		func() int {
			if req.SortOrder != nil {
				return *req.SortOrder
			}
			return 0
		}(),
		func() bool {
			if req.IsActive != nil {
				return *req.IsActive
			}
			return true
		}(),
		now,
		id,
	).Scan(&panoramaID, &createdAt, &now)

	if err != nil {
		return nil, fmt.Errorf("failed to update hotspot: %w", err)
	}

	return &models.HotspotResponse{
		ID:               id,
		PanoramaID:       panoramaID,
		PositionYaw:      req.PositionYaw,
		PositionPitch:    req.PositionPitch,
		TargetType:       req.TargetType,
		TargetPanoramaID: req.TargetPanoramaID,
		TargetFilename:   req.TargetFilename,
		Title:            req.Title,
		Tooltip:          req.Tooltip,
		Icon:             req.Icon,
		Color:            req.Color,
		SortOrder: func() int {
			if req.SortOrder != nil {
				return *req.SortOrder
			}
			return 0
		}(),
		IsActive: func() bool {
			if req.IsActive != nil {
				return *req.IsActive
			}
			return true
		}(),
		CreatedAt: createdAt.Format(time.RFC3339),
		UpdatedAt: now.Format(time.RFC3339),
	}, nil
}

func (r *HotspotRepository) GetByPanorama(ctx context.Context, panoramaID uuid.UUID) ([]models.HotspotResponse, error) {
	query := `
        SELECT 
            id, panorama_id, position_yaw, position_pitch,
            target_type, target_panorama_id, target_filename,
            title, tooltip, content_text, media_url, external_url,
            icon, color,
            sort_order, is_active, created_at, updated_at
        FROM hotspots
        WHERE panorama_id = $1 AND is_active = true
        ORDER BY sort_order
    `

	log.Printf("DEBUG: Executing query for panorama_id: %s", panoramaID)

	rows, err := r.pool.Query(ctx, query, panoramaID)
	if err != nil {
		log.Printf("ERROR: Query failed: %v", err)
		return nil, err
	}
	defer rows.Close()

	hotspots := make([]models.HotspotResponse, 0)
	for rows.Next() {
		var h models.HotspotResponse
		var sortOrder int32
		var isActive bool
		var createdAt, updatedAt time.Time

		var contentText, mediaURL, externalURL, targetPanoramaID *string

		err := rows.Scan(
			&h.ID, &h.PanoramaID, &h.PositionYaw, &h.PositionPitch,
			&h.TargetType, &targetPanoramaID, &h.TargetFilename,
			&h.Title, &h.Tooltip, &contentText, &mediaURL, &externalURL,
			&h.Icon, &h.Color,
			&sortOrder, &isActive, &createdAt, &updatedAt,
		)
		if err != nil {
			log.Printf("ERROR: Scan failed: %v", err)
			return nil, err
		}

		if contentText != nil {
			h.ContentText = *contentText
		}
		if mediaURL != nil {
			h.MediaURL = *mediaURL
		}
		if externalURL != nil {
			h.ExternalURL = *externalURL
		}

		h.SortOrder = int(sortOrder)
		h.IsActive = isActive
		h.CreatedAt = createdAt.Format(time.RFC3339)
		h.UpdatedAt = updatedAt.Format(time.RFC3339)

		hotspots = append(hotspots, h)
	}

	log.Printf("DEBUG: Scanned %d hotspots", len(hotspots))
	return hotspots, rows.Err()
}
func (r *HotspotRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE hotspots SET is_active = false, updated_at = $1 WHERE id = $2`
	_, err := r.pool.Exec(ctx, query, time.Now(), id)
	return err
}
