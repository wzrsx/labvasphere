package dto

type LikeToggleResponse struct {
	Success   bool   `json:"success"`
	Liked     bool   `json:"liked"`      
	LikesCount int   `json:"likes_count"`
}