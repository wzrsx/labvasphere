-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TABLE IF NOT EXISTS public.likes
(
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT likes_pkey PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS public.project_tags
(
    project_id uuid NOT NULL,
    tag_id integer NOT NULL,
    CONSTRAINT project_tags_pkey PRIMARY KEY (project_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.projects
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    cover_image_url text COLLATE pg_catalog."default",
    panorama_url text COLLATE pg_catalog."default" NOT NULL,
    author_id uuid NOT NULL,
    views_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    published_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    status character varying(30) COLLATE pg_catalog."default",
    CONSTRAINT projects_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tags
(
    id serial NOT NULL,
    name character varying(50) COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT tags_pkey PRIMARY KEY (id),
    CONSTRAINT tags_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.users
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    full_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    email character varying(255) COLLATE pg_catalog."default" NOT NULL,
    password_hash text COLLATE pg_catalog."default",
    avatar_url text COLLATE pg_catalog."default",
    bio text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'user'::character varying,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

ALTER TABLE IF EXISTS public.likes
    ADD CONSTRAINT likes_project_id_fkey FOREIGN KEY (project_id)
    REFERENCES public.projects (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_likes_project
    ON public.likes(project_id);

ALTER TABLE IF EXISTS public.likes
    ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.project_tags
    ADD CONSTRAINT project_tags_project_id_fkey FOREIGN KEY (project_id)
    REFERENCES public.projects (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.project_tags
    ADD CONSTRAINT project_tags_tag_id_fkey FOREIGN KEY (tag_id)
    REFERENCES public.tags (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.projects
    ADD CONSTRAINT projects_author_id_fkey FOREIGN KEY (author_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_author
    ON public.projects(author_id);

END;