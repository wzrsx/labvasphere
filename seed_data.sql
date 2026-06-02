--
-- PostgreSQL database dump
--

\restrict AZCghcFT5BEXhBDvu86ZOWbAEfBdwxJqYQn6QURGLARaQuNwwRtTbAf5yH4oBCY

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO "public"."users" ("id", "full_name", "email", "password_hash", "avatar_url", "bio", "created_at", "updated_at", "role") VALUES ('3787c1cb-91ac-43bd-84fe-9068aca555ea', 'Кулиш Никита Станиславович', 'admin@admin.ru', '$2a$12$y96NfFi5r4ZbrwnMPHI5Nu5ZR2/Q0KbUfyEpCleWPwQCbyIMF.vjC', NULL, NULL, '2026-05-06 14:01:28.591141+00', '2026-05-06 14:01:28.591141+00', 'user');


--
-- Data for Name: commission_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO "public"."projects" ("id", "title", "description", "cover_image_url", "author_id", "views_count", "created_at", "published_at", "updated_at", "status") VALUES ('c32fffdb-e362-4e7a-9b56-e77d2baf48c6', 'Проект1', NULL, 'projects/c32fffdb-e362-4e7a-9b56-e77d2baf48c6/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:19:38.34988+00', NULL, '2026-05-06 14:19:50.087785+00', 'published');
INSERT INTO "public"."projects" ("id", "title", "description", "cover_image_url", "author_id", "views_count", "created_at", "published_at", "updated_at", "status") VALUES ('42ecab40-57b9-4a3c-8bf6-3737487b96a4', 'Проект2', NULL, 'projects/42ecab40-57b9-4a3c-8bf6-3737487b96a4/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:20:32.193393+00', NULL, '2026-05-06 14:20:32.312539+00', 'published');
INSERT INTO "public"."projects" ("id", "title", "description", "cover_image_url", "author_id", "views_count", "created_at", "published_at", "updated_at", "status") VALUES ('2d8447f9-aab8-4a09-8775-0a0b839ade64', 'Проект3', NULL, 'projects/2d8447f9-aab8-4a09-8775-0a0b839ade64/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:20:47.986707+00', NULL, '2026-05-06 14:20:48.076177+00', 'published');
INSERT INTO "public"."projects" ("id", "title", "description", "cover_image_url", "author_id", "views_count", "created_at", "published_at", "updated_at", "status") VALUES ('524a866f-c8dc-4e9e-97f6-ca6f2e6db650', 'Проект4', NULL, 'projects/524a866f-c8dc-4e9e-97f6-ca6f2e6db650/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:20:59.172206+00', NULL, '2026-05-06 14:20:59.26122+00', 'published');
INSERT INTO "public"."projects" ("id", "title", "description", "cover_image_url", "author_id", "views_count", "created_at", "published_at", "updated_at", "status") VALUES ('0a47f995-0810-40db-8569-9479454a3a6d', 'Проект5', NULL, 'projects/0a47f995-0810-40db-8569-9479454a3a6d/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:21:10.707067+00', NULL, '2026-05-06 14:21:10.828548+00', 'published');
INSERT INTO "public"."projects" ("id", "title", "description", "cover_image_url", "author_id", "views_count", "created_at", "published_at", "updated_at", "status") VALUES ('ee0786f3-1b8d-4521-b15a-6409a5ef1697', 'Проект6', 'Проект с переходом', 'projects/ee0786f3-1b8d-4521-b15a-6409a5ef1697/cover_image.jpg', '3787c1cb-91ac-43bd-84fe-9068aca555ea', 0, '2026-05-06 14:22:49.896292+00', NULL, '2026-05-06 14:23:52.0836+00', 'published');


--
-- Data for Name: panoramas; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO "public"."panoramas" ("id", "project_id", "filename", "original_filename", "file_size", "mime_type", "title", "description", "sort_order", "thumbnail_url", "is_active", "created_at", "updated_at", "is_main") VALUES ('8e84f662-eb39-4aeb-9df3-c09d0374082a', 'c32fffdb-e362-4e7a-9b56-e77d2baf48c6', '1f8939a0-6803-4abf-8642-e7cbc7d341dc_1778077178.jpg', 'Проект1.jpg', 0, '', 'Проект1 - Основная панорама', '', 0, '', true, '2026-05-06 14:19:38.461629+00', '2026-05-06 14:19:38.461629+00', true);
INSERT INTO "public"."panoramas" ("id", "project_id", "filename", "original_filename", "file_size", "mime_type", "title", "description", "sort_order", "thumbnail_url", "is_active", "created_at", "updated_at", "is_main") VALUES ('cad3210a-0e0e-4681-b7c2-9a41960a3a2e', '42ecab40-57b9-4a3c-8bf6-3737487b96a4', 'fa8e693b-d6b8-45d8-82e2-db01e3ba806d_1778077232.jpg', 'Проект2.jpg', 0, '', 'Проект2 - Основная панорама', '', 0, '', true, '2026-05-06 14:20:32.303194+00', '2026-05-06 14:20:32.303194+00', true);
INSERT INTO "public"."panoramas" ("id", "project_id", "filename", "original_filename", "file_size", "mime_type", "title", "description", "sort_order", "thumbnail_url", "is_active", "created_at", "updated_at", "is_main") VALUES ('df53c222-4a57-4943-a4e7-354d2533864f', '2d8447f9-aab8-4a09-8775-0a0b839ade64', '1d0155aa-9539-4d89-b6fb-1cc64c9df8f8_1778077248.jpg', 'Проект3.jpg', 0, '', 'Проект3 - Основная панорама', '', 0, '', true, '2026-05-06 14:20:48.060459+00', '2026-05-06 14:20:48.060459+00', true);
INSERT INTO "public"."panoramas" ("id", "project_id", "filename", "original_filename", "file_size", "mime_type", "title", "description", "sort_order", "thumbnail_url", "is_active", "created_at", "updated_at", "is_main") VALUES ('e8bc841a-b0da-4f91-b4db-e2aaa21e5226', '524a866f-c8dc-4e9e-97f6-ca6f2e6db650', '51f1af75-b809-4ca6-84d5-e67f653dda09_1778077259.jpg', 'Проект4.jpg', 0, '', 'Проект4 - Основная панорама', '', 0, '', true, '2026-05-06 14:20:59.248175+00', '2026-05-06 14:20:59.248175+00', true);
INSERT INTO "public"."panoramas" ("id", "project_id", "filename", "original_filename", "file_size", "mime_type", "title", "description", "sort_order", "thumbnail_url", "is_active", "created_at", "updated_at", "is_main") VALUES ('4940f02c-787b-477b-88f5-41673f9b5bad', '0a47f995-0810-40db-8569-9479454a3a6d', '03355334-8ad6-49a7-a1a2-bc286d832bf5_1778077270.jpg', 'Проект5.jpg', 0, '', 'Проект5 - Основная панорама', '', 0, '', true, '2026-05-06 14:21:10.819721+00', '2026-05-06 14:21:10.819721+00', true);
INSERT INTO "public"."panoramas" ("id", "project_id", "filename", "original_filename", "file_size", "mime_type", "title", "description", "sort_order", "thumbnail_url", "is_active", "created_at", "updated_at", "is_main") VALUES ('62c0eebf-5f16-4a67-9b41-117984c0fa35', 'ee0786f3-1b8d-4521-b15a-6409a5ef1697', 'f20f839d-9167-405c-9f2e-3b6600c5ed02_1778077369.jpg', 'Проект4.jpg', 0, '', 'Проект6 - Основная панорама', '', 0, '', true, '2026-05-06 14:22:49.990867+00', '2026-05-06 14:22:49.990867+00', true);
INSERT INTO "public"."panoramas" ("id", "project_id", "filename", "original_filename", "file_size", "mime_type", "title", "description", "sort_order", "thumbnail_url", "is_active", "created_at", "updated_at", "is_main") VALUES ('f2921ba7-4817-4b1f-ab63-9329c2d2ce81', 'ee0786f3-1b8d-4521-b15a-6409a5ef1697', '23e35367-8797-4b46-965e-2e6175b8de06_1778077426.jpg', 'Проект3.jpg', 10449526, 'image/jpeg', 'Панорама: Проект3.jpg', '', 0, 'projects/ee0786f3-1b8d-4521-b15a-6409a5ef1697/panoramas/thumb_23e35367-8797-4b46-965e-2e6175b8de06_1778077426.jpg', true, '2026-05-06 14:23:46.039606+00', '2026-05-06 14:23:46.039606+00', false);


--
-- Data for Name: hotspots; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO "public"."hotspots" ("id", "panorama_id", "position_yaw", "position_pitch", "target_type", "target_panorama_id", "target_filename", "title", "tooltip", "content_text", "media_url", "external_url", "icon", "color", "sort_order", "is_active", "created_at", "updated_at") VALUES ('d19d2eeb-9632-491b-ad32-5b6e80305c87', '62c0eebf-5f16-4a67-9b41-117984c0fa35', 2.8182809616391618, -0.16775280613098142, 'panorama', 'f2921ba7-4817-4b1f-ab63-9329c2d2ce81', '23e35367-8797-4b46-965e-2e6175b8de06_1778077426.jpg', 'Ванна', 'Ванна', NULL, NULL, NULL, 'default', '#3498db', NULL, true, '2026-05-06 14:23:46.05578+00', '2026-05-06 14:23:47.498485+00');


--
-- Data for Name: hotspot_analytics; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: likes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: project_tags; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: referral_clicks; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO "public"."wallets" ("user_id", "balance_gross", "balance_net", "currency", "updated_at") VALUES ('3787c1cb-91ac-43bd-84fe-9068aca555ea', 0.00, 0.00, 'RUB', '2026-05-06 14:01:58.5731+00');


--
-- Data for Name: withdrawals; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: tags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('"public"."tags_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict AZCghcFT5BEXhBDvu86ZOWbAEfBdwxJqYQn6QURGLARaQuNwwRtTbAf5yH4oBCY