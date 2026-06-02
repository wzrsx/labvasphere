package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"labvasphere-api/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PartnerRepositoryInterface определяет контракт для работы с партнёрской программой
type PartnerRepositoryInterface interface {
	// Рефералы
	CreateReferral(ctx context.Context, partnerID, referredUserID uuid.UUID, level int) error
	GetReferralChain(ctx context.Context, userID uuid.UUID) ([]models.Referral, error)
	GetReferralsByPartner(ctx context.Context, partnerID uuid.UUID, level *int) ([]models.Referral, error)
	GetReferrer(ctx context.Context, userID uuid.UUID) (*models.Referral, error)

	// Кошельки
	GetWallet(ctx context.Context, userID uuid.UUID) (*models.Wallet, error)
	UpdateWalletBalance(ctx context.Context, userID uuid.UUID, grossDelta, netDelta float64) error

	// Комиссии
	CreateCommissionLog(ctx context.Context, log *models.CommissionLog) error
	GetCommissionLogs(ctx context.Context, partnerID uuid.UUID, limit, offset int) ([]models.CommissionLog, error)

	// Заявки на вывод
	CreateWithdrawal(ctx context.Context, withdrawal *models.Withdrawal) error
	GetWithdrawals(ctx context.Context, userID uuid.UUID, status *string) ([]models.Withdrawal, error)
	UpdateWithdrawalStatus(ctx context.Context, id uuid.UUID, status string, adminComment string) error

	// Статистика
	GetPartnerStats(ctx context.Context, userID uuid.UUID) (*models.PartnerStats, error)

	// Трекинг переходов
	TrackReferralClick(ctx context.Context, partnerID uuid.UUID, sessionID string, ip string, userAgent string) error
	MarkReferralConverted(ctx context.Context, sessionID string, userID uuid.UUID) error

	// Распределение комиссии при оплате подписки
	DistributeCommission(ctx context.Context, tx pgx.Tx, payerID uuid.UUID, amount float64, paymentRef string) error
}

// PartnerRepository реализует PartnerRepositoryInterface
type PartnerRepository struct {
	pool *pgxpool.Pool
}

// NewPartnerRepository создаёт новый экземпляр репозитория
func NewPartnerRepository(pool *pgxpool.Pool) *PartnerRepository {
	return &PartnerRepository{pool: pool}
}

// ============================================================================
// РЕФЕРАЛЫ
// ============================================================================

// CreateReferral создаёт запись о реферальной связи
func (r *PartnerRepository) CreateReferral(ctx context.Context, partnerID, referredUserID uuid.UUID, level int) error {
	// Проверяем, не существует ли уже такая связь
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM referrals 
			WHERE partner_id = $1 AND referred_user_id = $2
		)
	`, partnerID, referredUserID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check referral exists: %w", err)
	}
	if exists {
		return nil // Уже есть, не дублируем
	}

	_, err = r.pool.Exec(ctx, `
		INSERT INTO referrals (partner_id, referred_user_id, level, created_at)
		VALUES ($1, $2, $3, NOW())
	`, partnerID, referredUserID, level)
	if err != nil {
		return fmt.Errorf("create referral: %w", err)
	}
	return nil
}

// GetReferralChain возвращает цепочку рефералов для пользователя (до 3 уровней вверх)
// Используется при начислении комиссии: кто получит % от оплаты этого пользователя
func (r *PartnerRepository) GetReferralChain(ctx context.Context, userID uuid.UUID) ([]models.Referral, error) {
	query := `
		WITH RECURSIVE upline AS (
			-- Уровень 1: кто пригласил текущего пользователя
			SELECT 
				partner_id,
				referred_user_id,
				level,
				1 as depth
			FROM referrals 
			WHERE referred_user_id = $1 AND level = 1
			
			UNION ALL
			
			-- Рекурсивно поднимаемся вверх по цепочке (до 3 уровня)
			SELECT 
				r.partner_id,
				r.referred_user_id,
				r.level,
				u.depth + 1
			FROM referrals r
			INNER JOIN upline u ON r.referred_user_id = u.partner_id
			WHERE u.depth < 3 AND r.level = u.depth + 1
		)
		SELECT partner_id, level 
		FROM upline 
		ORDER BY level ASC
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("get referral chain: %w", err)
	}
	defer rows.Close()

	var referrals []models.Referral
	for rows.Next() {
		var ref models.Referral
		if err := rows.Scan(&ref.PartnerID, &ref.Level); err != nil {
			return nil, fmt.Errorf("scan referral: %w", err)
		}
		referrals = append(referrals, ref)
	}

	return referrals, rows.Err()
}

// GetReferralsByPartner возвращает список рефералов партнёра (опционально по уровню)
func (r *PartnerRepository) GetReferralsByPartner(ctx context.Context, partnerID uuid.UUID, level *int) ([]models.Referral, error) {
	query := `
		SELECT id, partner_id, referred_user_id, level, created_at
		FROM referrals
		WHERE partner_id = $1
	`
	args := []interface{}{partnerID}

	if level != nil {
		query += " AND level = $2"
		args = append(args, *level)
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("get referrals by partner: %w", err)
	}
	defer rows.Close()

	var referrals []models.Referral
	for rows.Next() {
		var ref models.Referral
		if err := rows.Scan(&ref.ID, &ref.PartnerID, &ref.ReferredUserID, &ref.Level, &ref.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan referral: %w", err)
		}
		referrals = append(referrals, ref)
	}

	return referrals, rows.Err()
}

// GetReferrer возвращает непосредственного реферера пользователя (уровень 1)
func (r *PartnerRepository) GetReferrer(ctx context.Context, userID uuid.UUID) (*models.Referral, error) {
	var ref models.Referral
	err := r.pool.QueryRow(ctx, `
		SELECT id, partner_id, referred_user_id, level, created_at
		FROM referrals
		WHERE referred_user_id = $1 AND level = 1
	`, userID).Scan(&ref.ID, &ref.PartnerID, &ref.ReferredUserID, &ref.Level, &ref.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil // Нет реферера
	}
	if err != nil {
		return nil, fmt.Errorf("get referrer: %w", err)
	}
	return &ref, nil
}

// ============================================================================
// КОШЕЛЬКИ
// ============================================================================

// GetWallet возвращает кошелек пользователя (создаёт, если нет)
func (r *PartnerRepository) GetWallet(ctx context.Context, userID uuid.UUID) (*models.Wallet, error) {
	wallet := &models.Wallet{}

	err := r.pool.QueryRow(ctx, `
        SELECT user_id, balance_gross, balance_net, currency, updated_at
        FROM wallets
        WHERE user_id = $1
    `, userID).Scan(&wallet.UserID, &wallet.BalanceGross, &wallet.BalanceNet, &wallet.Currency, &wallet.UpdatedAt)

	// Если кошелька нет — создаём его атомарно
	if err == pgx.ErrNoRows {
		_, err = r.pool.Exec(ctx, `
            INSERT INTO wallets (user_id, balance_gross, balance_net, currency)
            VALUES ($1, 0, 0, 'RUB')
            ON CONFLICT (user_id) DO NOTHING
        `, userID)
		if err != nil {
			return nil, fmt.Errorf("create wallet fallback: %w", err)
		}
		// Рекурсивно получаем только что созданный кошелек
		return r.GetWallet(ctx, userID)
	}
	if err != nil {
		return nil, fmt.Errorf("get wallet: %w", err)
	}

	return wallet, nil
}

// UpdateWalletBalance обновляет баланс кошелька (атомарно)
func (r *PartnerRepository) UpdateWalletBalance(ctx context.Context, userID uuid.UUID, grossDelta, netDelta float64) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE wallets 
		SET 
			balance_gross = balance_gross + $1,
			balance_net = balance_net + $2,
			updated_at = NOW()
		WHERE user_id = $3
	`, grossDelta, netDelta, userID)

	if err != nil {
		return fmt.Errorf("update wallet balance: %w", err)
	}
	return nil
}

// ============================================================================
// КОМИССИИ
// ============================================================================

// CreateCommissionLog создаёт запись о начислении комиссии
func (r *PartnerRepository) CreateCommissionLog(ctx context.Context, log *models.CommissionLog) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO commission_logs (
			id, partner_id, payer_id, subscription_amount,
			commission_rate, commission_gross, commission_net,
			level, payment_reference, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
	`,
		uuid.New(), log.PartnerID, log.PayerID, log.SubscriptionAmount,
		log.CommissionRate, log.CommissionGross, log.CommissionNet,
		log.Level, log.PaymentReference,
	)
	if err != nil {
		return fmt.Errorf("create commission log: %w", err)
	}
	return nil
}

// GetCommissionLogs возвращает историю начислений для партнёра
func (r *PartnerRepository) GetCommissionLogs(ctx context.Context, partnerID uuid.UUID, limit, offset int) ([]models.CommissionLog, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT 
			id, partner_id, payer_id, subscription_amount,
			commission_rate, commission_gross, commission_net,
			level, payment_reference, created_at
		FROM commission_logs
		WHERE partner_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, partnerID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("get commission logs: %w", err)
	}
	defer rows.Close()

	var logs []models.CommissionLog
	for rows.Next() {
		var log models.CommissionLog
		if err := rows.Scan(
			&log.ID, &log.PartnerID, &log.PayerID, &log.SubscriptionAmount,
			&log.CommissionRate, &log.CommissionGross, &log.CommissionNet,
			&log.Level, &log.PaymentReference, &log.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan commission log: %w", err)
		}
		logs = append(logs, log)
	}

	return logs, rows.Err()
}

// ============================================================================
// ЗАЯВКИ НА ВЫВОД
// ============================================================================

// CreateWithdrawal создаёт заявку на вывод средств
func (r *PartnerRepository) CreateWithdrawal(ctx context.Context, withdrawal *models.Withdrawal) error {
	withdrawal.ID = uuid.New()
	withdrawal.Status = "pending"
	withdrawal.CreatedAt = time.Now()
	withdrawal.UpdatedAt = time.Now()

	_, err := r.pool.Exec(ctx, `
		INSERT INTO withdrawals (
			id, user_id, amount, method, details, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`,
		withdrawal.ID, withdrawal.UserID, withdrawal.Amount,
		withdrawal.Method, withdrawal.Details, withdrawal.Status,
		withdrawal.CreatedAt, withdrawal.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create withdrawal: %w", err)
	}
	return nil
}

// GetWithdrawals возвращает список заявок пользователя
func (r *PartnerRepository) GetWithdrawals(ctx context.Context, userID uuid.UUID, status *string) ([]models.Withdrawal, error) {
	query := `
		SELECT id, user_id, amount, method, details, status, admin_comment, created_at, updated_at
		FROM withdrawals
		WHERE user_id = $1
	`
	args := []interface{}{userID}
	argIdx := 2

	if status != nil && *status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("get withdrawals: %w", err)
	}
	defer rows.Close()

	var withdrawals []models.Withdrawal
	for rows.Next() {
		var w models.Withdrawal
		if err := rows.Scan(
			&w.ID, &w.UserID, &w.Amount, &w.Method, &w.Details,
			&w.Status, &w.AdminComment, &w.CreatedAt, &w.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan withdrawal: %w", err)
		}
		withdrawals = append(withdrawals, w)
	}

	return withdrawals, rows.Err()
}

// UpdateWithdrawalStatus обновляет статус заявки (для админки)
func (r *PartnerRepository) UpdateWithdrawalStatus(ctx context.Context, id uuid.UUID, status string, adminComment string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE withdrawals 
		SET status = $1, admin_comment = $2, updated_at = NOW()
		WHERE id = $3
	`, status, adminComment, id)
	if err != nil {
		return fmt.Errorf("update withdrawal status: %w", err)
	}
	return nil
}

// ============================================================================
// СТАТИСТИКА
// ============================================================================

// GetPartnerStats собирает полную статистику партнёра
func (r *PartnerRepository) GetPartnerStats(ctx context.Context, userID uuid.UUID) (*models.PartnerStats, error) {
	stats := &models.PartnerStats{}

	// Получаем баланс из кошелька
	wallet, err := r.GetWallet(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get wallet for stats: %w", err)
	}
	stats.BalanceNet = wallet.BalanceNet

	// Считаем рефералов по уровням
	err = r.pool.QueryRow(ctx, `
		SELECT 
			COUNT(CASE WHEN level = 1 THEN 1 END),
			COUNT(CASE WHEN level = 2 THEN 1 END),
			COUNT(CASE WHEN level = 3 THEN 1 END)
		FROM referrals
		WHERE partner_id = $1
	`, userID).Scan(&stats.ReferralsLevel1, &stats.ReferralsLevel2, &stats.ReferralsLevel3)
	if err != nil {
		return nil, fmt.Errorf("count referrals: %w", err)
	}

	// Сумма всех начислений (заработано всего)
	err = r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(commission_net), 0)
		FROM commission_logs
		WHERE partner_id = $1
	`, userID).Scan(&stats.TotalEarned)
	if err != nil {
		return nil, fmt.Errorf("sum commissions: %w", err)
	}

	// Сумма всех выплаченных средств
	err = r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM withdrawals
		WHERE user_id = $1 AND status = 'paid'
	`, userID).Scan(&stats.TotalWithdrawals)
	if err != nil {
		return nil, fmt.Errorf("sum withdrawals: %w", err)
	}

	return stats, nil
}

// ============================================================================
// ТРЕКИНГ ПЕРЕХОДОВ
// ============================================================================

// TrackReferralClick записывает переход по реферальной ссылке
func (r *PartnerRepository) TrackReferralClick(ctx context.Context, partnerID uuid.UUID, sessionID string, ip string, userAgent string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO referral_clicks (partner_id, session_id, ip_address, user_agent, clicked_at)
		VALUES ($1, $2, $3, $4, NOW())
	`, partnerID, sessionID, ip, userAgent)
	if err != nil {
		return fmt.Errorf("track referral click: %w", err)
	}
	return nil
}

// MarkReferralConverted отмечает, что сессия привела к регистрации
// Вызывается при успешной регистрации пользователя
func (r *PartnerRepository) MarkReferralConverted(ctx context.Context, sessionID string, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE referral_clicks 
		SET converted_at = NOW()
		WHERE session_id = $1 AND converted_at IS NULL
	`, sessionID)
	if err != nil {
		return fmt.Errorf("mark referral converted: %w", err)
	}
	return nil
}

// ============================================================================
// РАСПРЕДЕЛЕНИЕ КОМИССИИ (КЛЮЧЕВАЯ ЛОГИКА)
// ============================================================================

// DistributeCommission распределяет комиссию по 3 уровням при оплате подписки
// Вызывается из вебхука платежной системы внутри транзакции
func (r *PartnerRepository) DistributeCommission(ctx context.Context, tx pgx.Tx, payerID uuid.UUID, amount float64, paymentRef string) error {
	const taxRate = 0.06 // 6% УСН удерживается системой

	// Процентные ставки по уровням
	rates := map[int]float64{
		1: 0.075, // 7.5%
		2: 0.050, // 5.0%
		3: 0.025, // 2.5%
	}

	// Получаем цепочку рефералов (кто получит %)
	referrals, err := r.getReferralChainWithTx(ctx, tx, payerID)
	if err != nil {
		return fmt.Errorf("get referral chain: %w", err)
	}

	if len(referrals) == 0 {
		return nil // Нет рефералов — нечего начислять
	}

	// Начисляем комиссию каждому партнёру в цепочке
	for _, ref := range referrals {
		rate, ok := rates[ref.Level]
		if !ok {
			continue
		}

		gross := amount * rate       // До налога
		net := gross * (1 - taxRate) // После удержания 6%

		// 1. Создаём лог комиссии
		log := &models.CommissionLog{
			ID:                 uuid.New(),
			PartnerID:          ref.PartnerID,
			PayerID:            payerID,
			SubscriptionAmount: amount,
			CommissionRate:     rate * 100, // храним в %
			CommissionGross:    gross,
			CommissionNet:      net,
			Level:              ref.Level,
			PaymentReference:   paymentRef,
			CreatedAt:          time.Now(),
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO commission_logs (
				id, partner_id, payer_id, subscription_amount,
				commission_rate, commission_gross, commission_net,
				level, payment_reference, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`,
			log.ID, log.PartnerID, log.PayerID, log.SubscriptionAmount,
			log.CommissionRate, log.CommissionGross, log.CommissionNet,
			log.Level, log.PaymentReference, log.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("create commission log: %w", err)
		}

		// 2. Обновляем баланс партнёра (атомарно в рамках транзакции)
		_, err = tx.Exec(ctx, `
			UPDATE wallets 
			SET 
				balance_gross = balance_gross + $1,
				balance_net = balance_net + $2,
				updated_at = NOW()
			WHERE user_id = $3
		`, gross, net, ref.PartnerID)
		if err != nil {
			return fmt.Errorf("update wallet for partner %s: %w", ref.PartnerID, err)
		}
	}

	return nil
}

// Вспомогательный метод для получения цепочки в рамках транзакции
func (r *PartnerRepository) getReferralChainWithTx(ctx context.Context, tx pgx.Tx, userID uuid.UUID) ([]models.Referral, error) {
	query := `
		WITH RECURSIVE upline AS (
			SELECT partner_id, referred_user_id, level, 1 as depth
			FROM referrals 
			WHERE referred_user_id = $1 AND level = 1
			
			UNION ALL
			
			SELECT r.partner_id, r.referred_user_id, r.level, u.depth + 1
			FROM referrals r
			INNER JOIN upline u ON r.referred_user_id = u.partner_id
			WHERE u.depth < 3 AND r.level = u.depth + 1
		)
		SELECT partner_id, level 
		FROM upline 
		ORDER BY level ASC
	`

	rows, err := tx.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var referrals []models.Referral
	for rows.Next() {
		var ref models.Referral
		if err := rows.Scan(&ref.PartnerID, &ref.Level); err != nil {
			return nil, err
		}
		referrals = append(referrals, ref)
	}

	return referrals, rows.Err()
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
// ============================================================================

// CheckReferralExists проверяет, существует ли связь между пользователями
func (r *PartnerRepository) CheckReferralExists(ctx context.Context, partnerID, referredUserID uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM referrals 
			WHERE partner_id = $1 AND referred_user_id = $2
		)
	`, partnerID, referredUserID).Scan(&exists)
	return exists, err
}

// GetWalletBalance возвращает только баланс (лёгкий запрос для частых проверок)
func (r *PartnerRepository) GetWalletBalance(ctx context.Context, userID uuid.UUID) (float64, error) {
	var balance float64
	err := r.pool.QueryRow(ctx, `
		SELECT balance_net FROM wallets WHERE user_id = $1
	`, userID).Scan(&balance)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return balance, err
}
