-- init.sql
-- Инициализация БД для Docker-контейнера PostgreSQL
-- Запускается автоматически при первом старте контейнера

-- Установка таймаута для долгих миграций
SET statement_timeout = 0;

-- Расширения (требуется для gen_random_uuid())
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

-- Избранное (НОВАЯ ТАБЛИЦА)
CREATE TABLE public.favorites (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (user_id, project_id)
);

-- Настройки пользователей (НОВАЯ ТАБЛИЦА)
CREATE TABLE public.user_settings (
    user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
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
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
    partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id character varying(255),
    ip_address inet,
    user_agent text,
    clicked_at timestamp with time zone DEFAULT now(),
    converted_at timestamp with time zone
);

-- Логи комиссий
CREATE TABLE public.commission_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_favorites_project_id ON public.favorites(project_id);
CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);
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

-- Триггеры для таблиц с updated_at (включая новую user_settings)
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_panoramas_updated_at BEFORE UPDATE ON public.panoramas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hotspots_updated_at BEFORE UPDATE ON public.hotspots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- НАЧАЛЬНЫЕ ДАННЫЕ (SEED)
-- ============================================
BEGIN;

-- Пользователи (ПАРОЛЬ: Test@1234)
INSERT INTO "public"."users" ("id", "full_name", "email", "password_hash", "avatar_url", "bio", "created_at", "updated_at", "role") VALUES
('3787c1cb-91ac-43bd-84fe-9068aca555ea', 'Кулиш Никита Станиславович', 'admin@admin.ru', '$2a$12$9Ws1RC19BuTzweIo/ivj7.HhZxTkGUPl3HAgdk1bF6T6B31t0hgWq', NULL, NULL, '2026-05-06 14:01:28.591141+00', '2026-05-06 14:01:28.591141+00', 'designer');

-- Проекты
INSERT INTO "public"."projects" ("id", "title", "description", "cover_image_url", "author_id", "views_count", "created_at", "published_at", "updated_at", "status") VALUES
('c32fffdb-e362-4e7a-9b56-e77d2baf48c6', 'Проект1', NULL, 'projects/c32fffdb-e362-4e7a-9b56-e77d2baf48c6/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:19:38.34988+00', NULL, '2026-05-06 14:19:50.087785+00', 'published'),
('42ecab40-57b9-4a3c-8bf6-3737487b96a4', 'Проект2', NULL, 'projects/42ecab40-57b9-4a3c-8bf6-3737487b96a4/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:20:32.193393+00', NULL, '2026-05-06 14:20:32.312539+00', 'published'),
('2d8447f9-aab8-4a09-8775-0a0b839ade64', 'Проект3', NULL, 'projects/2d8447f9-aab8-4a09-8775-0a0b839ade64/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:20:47.986707+00', NULL, '2026-05-06 14:20:48.076177+00', 'published'),
('524a866f-c8dc-4e9e-97f6-ca6f2e6db650', 'Проект4', NULL, 'projects/524a866f-c8dc-4e9e-97f6-ca6f2e6db650/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:20:59.172206+00', NULL, '2026-05-06 14:20:59.26122+00', 'published'),
('0a47f995-0810-40db-8569-9479454a3a6d', 'Проект5', NULL, 'projects/0a47f995-0810-40db-8569-9479454a3a6d/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:21:10.707067+00', NULL, '2026-05-06 14:21:10.828548+00', 'published'),
('ee0786f3-1b8d-4521-b15a-6409a5ef1697', 'Проект6', 'Проект с переходом', 'projects/ee0786f3-1b8d-4521-b15a-6409a5ef1697/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:22:49.896292+00', NULL, '2026-05-06 14:23:52.0836+00', 'published');

-- Панорамы
INSERT INTO "public"."panoramas" ("id", "project_id", "filename", "original_filename", "file_size", "mime_type", "title", "description", "sort_order", "thumbnail_url", "is_active", "created_at", "updated_at", "is_main") VALUES
('8e84f662-eb39-4aeb-9df3-c09d0374082a', 'c32fffdb-e362-4e7a-9b56-e77d2baf48c6', '1f8939a0-6803-4abf-8642-e7cbc7d341dc_1778077178.jpg', 'Проект1.jpg', 0, '', 'Проект1 - Основная панорама', '', 0, '', true, '2026-05-06 14:19:38.461629+00', '2026-05-06 14:19:38.461629+00', true),
('cad3210a-0e0e-4681-b7c2-9a41960a3a2e', '42ecab40-57b9-4a3c-8bf6-3737487b96a4', 'fa8e693b-d6b8-45d8-82e2-db01e3ba806d_1778077232.jpg', 'Проект2.jpg', 0, '', 'Проект2 - Основная панорама', '', 0, '', true, '2026-05-06 14:20:32.303194+00', '2026-05-06 14:20:32.303194+00', true),
('df53c222-4a57-4943-a4e7-354d2533864f', '2d8447f9-aab8-4a09-8775-0a0b839ade64', '1d0155aa-9539-4d89-b6fb-1cc64c9df8f8_1778077248.jpg', 'Проект3.jpg', 0, '', 'Проект3 - Основная панорама', '', 0, '', true, '2026-05-06 14:20:48.060459+00', '2026-05-06 14:20:48.060459+00', true),
('e8bc841a-b0da-4f91-b4db-e2aaa21e5226', '524a866f-c8dc-4e9e-97f6-ca6f2e6db650', '51f1af75-b809-4ca6-84d5-e67f653dda09_1778077259.jpg', 'Проект4.jpg', 0, '', 'Проект4 - Основная панорама', '', 0, '', true, '2026-05-06 14:20:59.248175+00', '2026-05-06 14:20:59.248175+00', true),
('4940f02c-787b-477b-88f5-41673f9b5bad', '0a47f995-0810-40db-8569-9479454a3a6d', '03355334-8ad6-49a7-a1a2-bc286d832bf5_1778077270.jpg', 'Проект5.jpg', 0, '', 'Проект5 - Основная панорама', '', 0, '', true, '2026-05-06 14:21:10.819721+00', '2026-05-06 14:21:10.819721+00', true),
('62c0eebf-5f16-4a67-9b41-117984c0fa35', 'ee0786f3-1b8d-4521-b15a-6409a5ef1697', 'f20f839d-9167-405c-9f2e-3b6600c5ed02_1778077369.jpg', 'Проект4.jpg', 0, '', 'Проект6 - Основная панорама', '', 0, '', true, '2026-05-06 14:22:49.990867+00', '2026-05-06 14:22:49.990867+00', true),
('f2921ba7-4817-4b1f-ab63-9329c2d2ce81', 'ee0786f3-1b8d-4521-b15a-6409a5ef1697', '23e35367-8797-4b46-965e-2e6175b8de06_1778077426.jpg', 'Проект3.jpg', 10449526, 'image/jpeg', 'Панорама: Проект3.jpg', '', 0, 'projects/ee0786f3-1b8d-4521-b15a-6409a5ef1697/panoramas/thumb_23e35367-8797-4b46-965e-2e6175b8de06_1778077426.jpg', true, '2026-05-06 14:23:46.039606+00', '2026-05-06 14:23:46.039606+00', false);

-- Хотспоты
INSERT INTO "public"."hotspots" ("id", "panorama_id", "position_yaw", "position_pitch", "target_type", "target_panorama_id", "target_filename", "title", "tooltip", "content_text", "media_url", "external_url", "icon", "color", "sort_order", "is_active", "created_at", "updated_at") VALUES
('d19d2eeb-9632-491b-ad32-5b6e80305c87', '62c0eebf-5f16-4a67-9b41-117984c0fa35', 2.8182809616391618, -0.16775280613098142, 'panorama', 'f2921ba7-4817-4b1f-ab63-9329c2d2ce81', '23e35367-8797-4b46-965e-2e6175b8de06_1778077426.jpg', 'Ванна', 'Ванна', NULL, NULL, NULL, 'default', '#3498db', NULL, true, '2026-05-06 14:23:46.05578+00', '2026-05-06 14:23:47.498485+00');

-- Кошельки пользователей
INSERT INTO "public"."wallets" ("user_id", "balance_gross", "balance_net", "currency", "updated_at") VALUES
('3787c1cb-91ac-43bd-84fe-9068aca555ea', 0.00, 0.00, 'RUB', '2026-05-06 14:01:58.5731+00');

-- Сброс последовательностей (чтобы будущие INSERT без явных ID не конфликтовали)
SELECT pg_catalog.setval('"public"."tags_id_seq"', 1, false);

COMMIT;