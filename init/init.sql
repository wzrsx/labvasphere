-- init.sql
-- Инициализация БД для Docker-контейнера PostgreSQL
-- Запускается автоматически при первом старте контейнера

-- Установка таймаута для долгих миграций
SET statement_timeout = 0;

-- Расширения (требуется для gen_random_uuid())
-- В PostgreSQL 13+ функция встроена, но для совместимости:
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- ТАБЛИЦЫ (в порядке зависимостей)
-- ============================================

-- Пользователи (базовая таблица)
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL UNIQUE,
    password_hash text,
    avatar_url text,
    bio text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role character varying(50) NOT NULL DEFAULT 'user'
);

-- Теги
CREATE TABLE public.tags (
    id serial PRIMARY KEY,
    name character varying(50) NOT NULL UNIQUE
);

-- Проекты
CREATE TABLE public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title character varying(255) NOT NULL,
    description text,
    cover_image_url text,
    author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    views_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    published_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    status character varying(30)
);

-- Панорамы
CREATE TABLE public.panoramas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    filename character varying(255) NOT NULL,
    original_filename character varying(255) NOT NULL,
    file_size bigint,
    mime_type character varying(100),
    title character varying(255),
    description text,
    sort_order integer DEFAULT 0,
    thumbnail_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_main boolean DEFAULT false,
    UNIQUE (project_id, filename)
);

-- Хотспоты (интерактивные метки на панорамах)
CREATE TABLE public.hotspots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    panorama_id uuid NOT NULL REFERENCES public.panoramas(id) ON DELETE CASCADE,
    position_yaw double precision NOT NULL,
    position_pitch double precision NOT NULL,
    target_type character varying(20) NOT NULL DEFAULT 'panorama',
    target_panorama_id uuid REFERENCES public.panoramas(id) ON DELETE CASCADE,
    target_filename character varying(255),
    title character varying(255),
    tooltip text,
    content_text text,
    media_url text,
    external_url text,
    icon character varying(50) DEFAULT 'default',
    color character varying(7),
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Аналитика кликов по хотспотам
CREATE TABLE public.hotspot_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hotspot_id uuid NOT NULL REFERENCES public.hotspots(id) ON DELETE CASCADE,
    clicked_at timestamp with time zone DEFAULT now(),
    session_id character varying(255),
    user_agent text,
    ip_address inet,
    from_yaw double precision,
    from_pitch double precision,
    zoom_level real DEFAULT 1.0
);

-- Связь проектов и тегов
CREATE TABLE public.project_tags (
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tag_id integer NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, tag_id)
);

-- Лайки
CREATE TABLE public.likes (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (user_id, project_id)
);

-- Кошельки пользователей
CREATE TABLE public.wallets (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    balance_gross numeric(10, 2) NOT NULL DEFAULT 0.00,
    balance_net numeric(10, 2) NOT NULL DEFAULT 0.00,
    currency character varying(3) NOT NULL DEFAULT 'RUB',
    updated_at timestamp with time zone DEFAULT now()
);

-- Выводы средств
CREATE TABLE public.withdrawals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    amount numeric(10, 2) NOT NULL,
    method character varying(20) NOT NULL,
    details jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending',
    admin_comment text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Реферальная система
CREATE TABLE public.referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    level integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (partner_id, referred_user_id)
);

-- Клики по реферальным ссылкам
CREATE TABLE public.referral_clicks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES public.users(id),
    session_id character varying(255),
    ip_address inet,
    user_agent text,
    clicked_at timestamp with time zone DEFAULT now(),
    converted_at timestamp with time zone
);

-- Логи комиссий
CREATE TABLE public.commission_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES public.users(id),
    payer_id uuid NOT NULL REFERENCES public.users(id),
    subscription_amount numeric(10, 2) NOT NULL,
    commission_rate numeric(5, 2) NOT NULL,
    commission_gross numeric(10, 2) NOT NULL,
    commission_net numeric(10, 2) NOT NULL,
    level integer NOT NULL,
    payment_reference character varying(255),
    created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- ИНДЕКСЫ (для ускорения запросов)
-- ============================================

CREATE INDEX idx_projects_author ON public.projects(author_id);
CREATE INDEX idx_panoramas_project_id ON public.panoramas(project_id);
CREATE INDEX idx_hotspots_panorama_id ON public.hotspots(panorama_id);
CREATE INDEX idx_hotspots_target_panorama ON public.hotspots(target_panorama_id);
CREATE INDEX idx_analytics_hotspot_id ON public.hotspot_analytics(hotspot_id);
CREATE INDEX idx_likes_project ON public.likes(project_id);
CREATE INDEX idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX idx_referrals_partner_id ON public.referrals(partner_id);
CREATE INDEX idx_referrals_referred_id ON public.referrals(referred_user_id);
CREATE INDEX idx_referral_clicks_partner ON public.referral_clicks(partner_id);
CREATE INDEX idx_commission_logs_partner ON public.commission_logs(partner_id);

-- ============================================
-- ДОПОЛНИТЕЛЬНО: триггеры для updated_at
-- ============================================

-- Функция для автообновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для таблиц с updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON public.projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_panoramas_updated_at 
    BEFORE UPDATE ON public.panoramas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotspots_updated_at 
    BEFORE UPDATE ON public.hotspots 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at 
    BEFORE UPDATE ON public.wallets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at 
    BEFORE UPDATE ON public.withdrawals 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();