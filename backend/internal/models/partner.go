package models

import (
	"time"

	"github.com/google/uuid"
)

type ReferralLevel int

const (
	Level1 ReferralLevel = 1 // 7.5%
	Level2 ReferralLevel = 2 // 5.0%
	Level3 ReferralLevel = 3 // 2.5%
)

type Referral struct {
	ID             uuid.UUID `json:"id" db:"id"`
	PartnerID      uuid.UUID `json:"partner_id" db:"partner_id"`
	ReferredUserID uuid.UUID `json:"referred_user_id" db:"referred_user_id"`
	Level          int       `json:"level" db:"level"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type Wallet struct {
	UserID       uuid.UUID `json:"user_id" db:"user_id"`
	BalanceGross float64   `json:"balance_gross" db:"balance_gross"`
	BalanceNet   float64   `json:"balance_net" db:"balance_net"`
	Currency     string    `json:"currency" db:"currency"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type CommissionLog struct {
	ID                 uuid.UUID `json:"id" db:"id"`
	PartnerID          uuid.UUID `json:"partner_id" db:"partner_id"`
	PayerID            uuid.UUID `json:"payer_id" db:"payer_id"`
	SubscriptionAmount float64   `json:"subscription_amount" db:"subscription_amount"`
	CommissionRate     float64   `json:"commission_rate" db:"commission_rate"`
	CommissionGross    float64   `json:"commission_gross" db:"commission_gross"`
	CommissionNet      float64   `json:"commission_net" db:"commission_net"`
	Level              int       `json:"level" db:"level"`
	PaymentReference   string    `json:"payment_reference,omitempty" db:"payment_reference"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
}

type WithdrawalMethod string

const (
	MethodCard       WithdrawalMethod = "card"
	MethodCryptoUSDT WithdrawalMethod = "crypto_usdt"
	MethodCryptoBTC  WithdrawalMethod = "crypto_btc"
	MethodCryptoETH  WithdrawalMethod = "crypto_eth"
)

type Withdrawal struct {
	ID           uuid.UUID              `json:"id" db:"id"`
	UserID       uuid.UUID              `json:"user_id" db:"user_id"`
	Amount       float64                `json:"amount" db:"amount"`
	Method       WithdrawalMethod       `json:"method" db:"method"`
	Details      map[string]interface{} `json:"details" db:"details"` // JSONB
	Status       string                 `json:"status" db:"status"`
	AdminComment string                 `json:"admin_comment,omitempty" db:"admin_comment"`
	CreatedAt    time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at" db:"updated_at"`
}

type PartnerStats struct {
	BalanceNet       float64 `json:"balance_net"`
	TotalEarned      float64 `json:"total_earned"`
	ReferralsLevel1  int     `json:"referrals_level_1"`
	ReferralsLevel2  int     `json:"referrals_level_2"`
	ReferralsLevel3  int     `json:"referrals_level_3"`
	TotalWithdrawals float64 `json:"total_withdrawals"`
}
