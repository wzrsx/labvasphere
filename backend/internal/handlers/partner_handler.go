package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"labvasphere-api/internal/middleware"
	"labvasphere-api/internal/models"
	"labvasphere-api/internal/storage/postgres"

	"github.com/google/uuid"
)

type PartnerHandler struct {
	repo *postgres.PartnerRepository // Прямая зависимость на конкретный тип
}

func NewPartnerHandler(repo *postgres.PartnerRepository) *PartnerHandler {
	return &PartnerHandler{repo: repo}
}

func (h *PartnerHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(claims.UserID) // claims.UserID — string!
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid user ID"})
		return
	}

	stats, err := h.repo.GetPartnerStats(r.Context(), userID)
	if err != nil {
		log.Printf("GetStats error for user %s: %v", userID, err)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch stats"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats) 
}

func (h *PartnerHandler) GetReferralLink(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		writeJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// claims.UserID уже string — используем напрямую
	origin := r.URL.Query().Get("origin")
	if origin == "" {
		origin = "https://labvasphere.com" // Замените на ваш домен
	}

	referralLink := origin + "/?ref=" + claims.UserID

	writeJSON(w, http.StatusOK, map[string]string{
		"referral_link": referralLink,
		"ref_code":      claims.UserID,
	})
}

func (h *PartnerHandler) CreateWithdrawal(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		writeJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Amount  float64                `json:"amount"`
		Method  string                 `json:"method"`
		Details map[string]interface{} `json:"details"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Amount <= 0 {
		writeJSONError(w, http.StatusBadRequest, "Amount must be positive")
		return
	}

	allowedMethods := map[string]bool{
		"card": true, "crypto_usdt": true, "crypto_btc": true, "crypto_eth": true,
	}
	if !allowedMethods[req.Method] {
		writeJSONError(w, http.StatusBadRequest, "Unsupported withdrawal method")
		return
	}

	// Конвертация string → uuid.UUID
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid user ID format")
		return
	}

	wallet, err := h.repo.GetWallet(r.Context(), userID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to fetch wallet")
		return
	}

	if wallet.BalanceNet < req.Amount {
		writeJSONError(w, http.StatusBadRequest, "Insufficient balance")
		return
	}

	withdrawal := &models.Withdrawal{
		UserID:  userID, // uuid.UUID
		Amount:  req.Amount,
		Method:  models.WithdrawalMethod(req.Method),
		Details: req.Details,
		Status:  "pending",
	}

	if err := h.repo.CreateWithdrawal(r.Context(), withdrawal); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to create withdrawal")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":     withdrawal.ID,
		"amount": withdrawal.Amount,
		"method": withdrawal.Method,
		"status": withdrawal.Status,
	})
}

func (h *PartnerHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		writeJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid user ID format")
		return
	}

	limit := 20
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		fmt.Sscanf(o, "%d", &offset)
	}

	logs, err := h.repo.GetCommissionLogs(r.Context(), userID, limit, offset)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to fetch transactions")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items":  logs,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *PartnerHandler) GetReferrals(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserFromContext(r.Context())
	if claims == nil {
		writeJSONError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid user ID format")
		return
	}

	var level *int
	if l := r.URL.Query().Get("level"); l != "" {
		var lv int
		if _, err := fmt.Sscanf(l, "%d", &lv); err == nil && lv >= 1 && lv <= 3 {
			level = &lv
		}
	}

	referrals, err := h.repo.GetReferralsByPartner(r.Context(), userID, level)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "Failed to fetch referrals")
		return
	}

	writeJSON(w, http.StatusOK, referrals)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
