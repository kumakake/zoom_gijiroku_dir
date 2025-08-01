--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
	NEW.updated_at = CURRENT_TIMESTAMP;
	RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_jobs (
    id integer NOT NULL,
    job_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(8) NOT NULL,
    created_by_uuid uuid,
    type character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    meeting_id character varying(255),
    meeting_url character varying(500),
    data jsonb,
    result jsonb,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    output_data jsonb
);


ALTER TABLE public.agent_jobs OWNER TO postgres;

--
-- Name: agent_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.agent_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.agent_jobs_id_seq OWNER TO postgres;

--
-- Name: agent_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.agent_jobs_id_seq OWNED BY public.agent_jobs.id;


--
-- Name: distribution_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.distribution_logs (
    id integer NOT NULL,
    log_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(8) NOT NULL,
    transcript_uuid uuid,
    recipient_email character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    sent_at timestamp without time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.distribution_logs OWNER TO postgres;

--
-- Name: distribution_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.distribution_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.distribution_logs_id_seq OWNER TO postgres;

--
-- Name: distribution_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.distribution_logs_id_seq OWNED BY public.distribution_logs.id;


--
-- Name: meeting_transcripts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meeting_transcripts (
    id integer NOT NULL,
    transcript_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(8) NOT NULL,
    created_by_uuid uuid,
    meeting_id character varying(255),
    title character varying(500),
    content text,
    summary text,
    participants jsonb,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    job_uuid uuid,
    duration integer,
    zoom_meeting_id character varying(255),
    meeting_topic character varying(500),
    host_id character varying(255),
    host_email character varying(255),
    formatted_transcript text
);


ALTER TABLE public.meeting_transcripts OWNER TO postgres;

--
-- Name: meeting_transcripts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.meeting_transcripts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.meeting_transcripts_id_seq OWNER TO postgres;

--
-- Name: meeting_transcripts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.meeting_transcripts_id_seq OWNED BY public.meeting_transcripts.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    tenant_id character varying(8) NOT NULL,
    name character varying(255) NOT NULL,
    admin_email character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tenants_id_seq OWNER TO postgres;

--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: user_tenant_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_tenant_roles (
    id integer NOT NULL,
    user_uuid uuid NOT NULL,
    tenant_id character varying(8) NOT NULL,
    role character varying(50) DEFAULT 'tenant_admin'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_tenant_roles OWNER TO postgres;

--
-- Name: user_tenant_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_tenant_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_tenant_roles_id_seq OWNER TO postgres;

--
-- Name: user_tenant_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_tenant_roles_id_seq OWNED BY public.user_tenant_roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    user_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying,
    tenant_id character varying(8) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_user_role CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying, 'tenant_admin'::character varying])::text[]))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying, 'tenant_admin'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: zoom_tenant_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zoom_tenant_settings (
    id integer NOT NULL,
    tenant_id character varying(8),
    zoom_client_id character varying(255) NOT NULL,
    zoom_client_secret character varying(255),
    zoom_webhook_secret character varying(255),
    zoom_account_id character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    zoom_client_secret_encrypted bytea,
    zoom_webhook_secret_encrypted bytea
);


ALTER TABLE public.zoom_tenant_settings OWNER TO postgres;

--
-- Name: zoom_tenant_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zoom_tenant_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.zoom_tenant_settings_id_seq OWNER TO postgres;

--
-- Name: zoom_tenant_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zoom_tenant_settings_id_seq OWNED BY public.zoom_tenant_settings.id;


--
-- Name: agent_jobs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_jobs ALTER COLUMN id SET DEFAULT nextval('public.agent_jobs_id_seq'::regclass);


--
-- Name: distribution_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_logs ALTER COLUMN id SET DEFAULT nextval('public.distribution_logs_id_seq'::regclass);


--
-- Name: meeting_transcripts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_transcripts ALTER COLUMN id SET DEFAULT nextval('public.meeting_transcripts_id_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: user_tenant_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_roles ALTER COLUMN id SET DEFAULT nextval('public.user_tenant_roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: zoom_tenant_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zoom_tenant_settings ALTER COLUMN id SET DEFAULT nextval('public.zoom_tenant_settings_id_seq'::regclass);


--
-- Data for Name: agent_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.agent_jobs (id, job_uuid, tenant_id, created_by_uuid, type, status, meeting_id, meeting_url, data, result, error_message, created_at, updated_at, completed_at, output_data) FROM stdin;
\.


--
-- Data for Name: distribution_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.distribution_logs (id, log_uuid, tenant_id, transcript_uuid, recipient_email, status, sent_at, error_message, created_at) FROM stdin;
\.


--
-- Data for Name: meeting_transcripts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.meeting_transcripts (id, transcript_uuid, tenant_id, created_by_uuid, meeting_id, title, content, summary, participants, start_time, end_time, status, created_at, updated_at, job_uuid, duration, zoom_meeting_id, meeting_topic, host_id, host_email, formatted_transcript) FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenants (id, tenant_id, name, admin_email, is_active, created_at, updated_at) FROM stdin;
1	default0	デフォルトテナント	admin@example.com	t	2025-07-27 02:01:13.11661	2025-07-27 02:01:13.11661
\.


--
-- Data for Name: user_tenant_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_tenant_roles (id, user_uuid, tenant_id, role, is_active, created_at, updated_at) FROM stdin;
1	9c7b0ead-4822-4359-ab27-7e83220c72c6	default0	admin	t	2025-07-27 02:03:01.152282	2025-07-30 14:30:09.626597
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, user_uuid, email, password_hash, name, role, tenant_id, is_active, created_at, updated_at) FROM stdin;
1	9c7b0ead-4822-4359-ab27-7e83220c72c6	admin@example.com	$2a$12$dS5Nf546yf0msiiXwz3sieOm4TUuEog8RABZBmL5cbLstLNgILklC	システム管理者	admin	default0	t	2025-07-27 02:03:01.152282	2025-07-31 14:26:12.34972
\.


--
-- Data for Name: zoom_tenant_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zoom_tenant_settings (id, tenant_id, zoom_client_id, zoom_client_secret, zoom_webhook_secret, zoom_account_id, is_active, created_at, updated_at, zoom_client_secret_encrypted, zoom_webhook_secret_encrypted) FROM stdin;
\.


--
-- Name: agent_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.agent_jobs_id_seq', 38, true);


--
-- Name: distribution_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.distribution_logs_id_seq', 11, true);


--
-- Name: meeting_transcripts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.meeting_transcripts_id_seq', 4, true);


--
-- Name: tenants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tenants_id_seq', 37, true);


--
-- Name: user_tenant_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_tenant_roles_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: zoom_tenant_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zoom_tenant_settings_id_seq', 4, true);


--
-- Name: agent_jobs agent_jobs_job_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_jobs
    ADD CONSTRAINT agent_jobs_job_uuid_key UNIQUE (job_uuid);


--
-- Name: agent_jobs agent_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_jobs
    ADD CONSTRAINT agent_jobs_pkey PRIMARY KEY (id);


--
-- Name: distribution_logs distribution_logs_log_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_logs
    ADD CONSTRAINT distribution_logs_log_uuid_key UNIQUE (log_uuid);


--
-- Name: distribution_logs distribution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_logs
    ADD CONSTRAINT distribution_logs_pkey PRIMARY KEY (id);


--
-- Name: meeting_transcripts meeting_transcripts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_transcripts
    ADD CONSTRAINT meeting_transcripts_pkey PRIMARY KEY (id);


--
-- Name: meeting_transcripts meeting_transcripts_transcript_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_transcripts
    ADD CONSTRAINT meeting_transcripts_transcript_uuid_key UNIQUE (transcript_uuid);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_tenant_id_key UNIQUE (tenant_id);


--
-- Name: user_tenant_roles user_tenant_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_roles
    ADD CONSTRAINT user_tenant_roles_pkey PRIMARY KEY (id);


--
-- Name: user_tenant_roles user_tenant_roles_user_uuid_tenant_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_roles
    ADD CONSTRAINT user_tenant_roles_user_uuid_tenant_id_role_key UNIQUE (user_uuid, tenant_id, role);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_user_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_uuid_key UNIQUE (user_uuid);


--
-- Name: zoom_tenant_settings zoom_tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zoom_tenant_settings
    ADD CONSTRAINT zoom_tenant_settings_pkey PRIMARY KEY (id);


--
-- Name: idx_agent_jobs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_jobs_status ON public.agent_jobs USING btree (status);


--
-- Name: idx_agent_jobs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_jobs_tenant_id ON public.agent_jobs USING btree (tenant_id);


--
-- Name: idx_distribution_logs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_distribution_logs_tenant_id ON public.distribution_logs USING btree (tenant_id);


--
-- Name: idx_meeting_transcripts_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_transcripts_tenant_id ON public.meeting_transcripts USING btree (tenant_id);


--
-- Name: idx_tenants_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenants_tenant_id ON public.tenants USING btree (tenant_id);


--
-- Name: idx_user_tenant_roles_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tenant_roles_active ON public.user_tenant_roles USING btree (is_active);


--
-- Name: idx_user_tenant_roles_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tenant_roles_tenant_id ON public.user_tenant_roles USING btree (tenant_id);


--
-- Name: idx_user_tenant_roles_user_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_tenant_roles_user_uuid ON public.user_tenant_roles USING btree (user_uuid);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_tenant_id ON public.users USING btree (tenant_id);


--
-- Name: idx_users_tenant_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_tenant_role ON public.users USING btree (tenant_id, role);


--
-- Name: idx_zoom_tenant_settings_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_zoom_tenant_settings_tenant_id ON public.zoom_tenant_settings USING btree (tenant_id);


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_tenant_roles update_user_tenant_roles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_tenant_roles_updated_at BEFORE UPDATE ON public.user_tenant_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: zoom_tenant_settings update_zoom_tenant_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_zoom_tenant_settings_updated_at BEFORE UPDATE ON public.zoom_tenant_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agent_jobs agent_jobs_created_by_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_jobs
    ADD CONSTRAINT agent_jobs_created_by_uuid_fkey FOREIGN KEY (created_by_uuid) REFERENCES public.users(user_uuid);


--
-- Name: agent_jobs agent_jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_jobs
    ADD CONSTRAINT agent_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: distribution_logs distribution_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_logs
    ADD CONSTRAINT distribution_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: distribution_logs distribution_logs_transcript_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_logs
    ADD CONSTRAINT distribution_logs_transcript_uuid_fkey FOREIGN KEY (transcript_uuid) REFERENCES public.meeting_transcripts(transcript_uuid);


--
-- Name: zoom_tenant_settings fk_zoom_tenant_settings_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zoom_tenant_settings
    ADD CONSTRAINT fk_zoom_tenant_settings_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: meeting_transcripts meeting_transcripts_created_by_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_transcripts
    ADD CONSTRAINT meeting_transcripts_created_by_uuid_fkey FOREIGN KEY (created_by_uuid) REFERENCES public.users(user_uuid);


--
-- Name: meeting_transcripts meeting_transcripts_job_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_transcripts
    ADD CONSTRAINT meeting_transcripts_job_uuid_fkey FOREIGN KEY (job_uuid) REFERENCES public.agent_jobs(job_uuid);


--
-- Name: meeting_transcripts meeting_transcripts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_transcripts
    ADD CONSTRAINT meeting_transcripts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: user_tenant_roles user_tenant_roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_roles
    ADD CONSTRAINT user_tenant_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: user_tenant_roles user_tenant_roles_user_uuid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenant_roles
    ADD CONSTRAINT user_tenant_roles_user_uuid_fkey FOREIGN KEY (user_uuid) REFERENCES public.users(user_uuid) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- PostgreSQL database dump complete
--

