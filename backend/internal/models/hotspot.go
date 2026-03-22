package models

import "github.com/google/uuid"

// HotspotRequest — данные от фронтенда при создании/обновлении
type HotspotRequest struct {
	PanoramaID       uuid.UUID  `json:"panorama_id"`
	PositionYaw      float64    `json:"position_yaw"`
	PositionPitch    float64    `json:"position_pitch"`
	TargetType       string     `json:"target_type"` // "panorama", "url", "media"
	TargetPanoramaID *uuid.UUID `json:"target_panorama_id,omitempty"`
	TargetFilename   *string    `json:"target_filename,omitempty"`
	Title            *string    `json:"title,omitempty"`
	Tooltip          *string    `json:"tooltip,omitempty"`
	ContentText      *string    `json:"content_text,omitempty"`
	MediaURL         *string    `json:"media_url,omitempty"`
	ExternalURL      *string    `json:"external_url,omitempty"`
	Icon             *string    `json:"icon,omitempty"`
	Color            *string    `json:"color,omitempty"` // #RRGGBB
	SortOrder        *int       `json:"sort_order,omitempty"`
	IsActive         *bool      `json:"is_active,omitempty"`
}

// HotspotResponse — ответ клиенту
type HotspotResponse struct {
	ID               uuid.UUID  `json:"id"`
	PanoramaID       uuid.UUID  `json:"panorama_id"`
	PositionYaw      float64    `json:"position_yaw"`
	PositionPitch    float64    `json:"position_pitch"`
	TargetType       string     `json:"target_type"`
	TargetPanoramaID *uuid.UUID `json:"target_panorama_id,omitempty"`
	TargetFilename   *string    `json:"target_filename,omitempty"`
	Title            *string    `json:"title,omitempty"`
	Tooltip          *string    `json:"tooltip,omitempty"`
	ContentText      string     `json:"content_text,omitempty"`
	MediaURL         string     `json:"media_url,omitempty"`
	ExternalURL      string     `json:"external_url,omitempty"`
	Icon             *string    `json:"icon,omitempty"`
	Color            *string    `json:"color,omitempty"`
	SortOrder        int        `json:"sort_order"`
	IsActive         bool       `json:"is_active"`
	CreatedAt        string     `json:"created_at"`
	UpdatedAt        string     `json:"updated_at"`
}
type HotspotUpdateRequest struct {
	PositionYaw      *float64   `json:"position_yaw,omitempty"`
	PositionPitch    *float64   `json:"position_pitch,omitempty"`
	TargetType       *string    `json:"target_type,omitempty"`
	TargetPanoramaID *uuid.UUID `json:"target_panorama_id,omitempty"`
	TargetFilename   *string    `json:"target_filename,omitempty"`
	Title            *string    `json:"title,omitempty"`
	Tooltip          *string    `json:"tooltip,omitempty"`
	ContentText      *string    `json:"content_text,omitempty"`
	MediaURL         *string    `json:"media_url,omitempty"` // ← Можно обновлять
	ExternalURL      *string    `json:"external_url,omitempty"`
	Icon             *string    `json:"icon,omitempty"`
	Color            *string    `json:"color,omitempty"`
	IsActive         *bool      `json:"is_active,omitempty"`
}
