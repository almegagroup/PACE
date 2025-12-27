


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


CREATE SCHEMA IF NOT EXISTS "audit";


ALTER SCHEMA "audit" OWNER TO "postgres";


COMMENT ON SCHEMA "audit" IS 'Append-only audit logs and security events.';



COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "secure";


ALTER SCHEMA "secure" OWNER TO "postgres";


COMMENT ON SCHEMA "secure" IS 'Protected business data. RLS enforced.';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."erp_session_state" AS ENUM (
    'CREATED',
    'ACTIVE',
    'IDLE',
    'EXPIRED',
    'REVOKED',
    'DEAD'
);


ALTER TYPE "public"."erp_session_state" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auth_signup_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "company_hint" "text",
    "department_hint" "text",
    "designation_hint" "text",
    "state" "text" DEFAULT 'REQUESTED'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_reason" "text",
    CONSTRAINT "auth_signup_requests_state_check" CHECK (("state" = ANY (ARRAY['REQUESTED'::"text", 'REJECTED'::"text", 'APPROVED_SETUP_PENDING'::"text"])))
);


ALTER TABLE "public"."auth_signup_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."erp_session_timeline" (
    "id" bigint NOT NULL,
    "session_id" "text" NOT NULL,
    "user_id" "text",
    "from_state" "text",
    "to_state" "text" NOT NULL,
    "event" "text" NOT NULL,
    "request_id" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."erp_session_timeline" OWNER TO "postgres";


ALTER TABLE "public"."erp_session_timeline" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."erp_session_timeline_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "secure"."auth_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_token" "text" NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "last_seen_at" timestamp with time zone,
    CONSTRAINT "auth_sessions_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'REVOKED'::"text", 'EXPIRED'::"text"])))
);

ALTER TABLE ONLY "secure"."auth_sessions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "secure"."auth_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "secure"."auth_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identifier" "text" NOT NULL,
    "state" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auth_users_state_check" CHECK (("state" = ANY (ARRAY['ACTIVE'::"text", 'DISABLED'::"text", 'LOCKED'::"text"])))
);

ALTER TABLE ONLY "secure"."auth_users" FORCE ROW LEVEL SECURITY;


ALTER TABLE "secure"."auth_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "secure"."erp_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "state" "public"."erp_session_state" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_activity_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_reason" "text",
    "revoked_by" "text",
    "device_tag" "text",
    "request_id" "text"
);

ALTER TABLE ONLY "secure"."erp_sessions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "secure"."erp_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auth_signup_requests"
    ADD CONSTRAINT "auth_signup_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."erp_session_timeline"
    ADD CONSTRAINT "erp_session_timeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_signup_requests"
    ADD CONSTRAINT "uq_signup_email" UNIQUE ("email");



ALTER TABLE ONLY "public"."auth_signup_requests"
    ADD CONSTRAINT "uq_signup_phone" UNIQUE ("phone");



ALTER TABLE ONLY "secure"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "secure"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_session_token_key" UNIQUE ("session_token");



ALTER TABLE ONLY "secure"."auth_users"
    ADD CONSTRAINT "auth_users_identifier_key" UNIQUE ("identifier");



ALTER TABLE ONLY "secure"."auth_users"
    ADD CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "secure"."erp_sessions"
    ADD CONSTRAINT "erp_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_session_timeline_created" ON "public"."erp_session_timeline" USING "btree" ("created_at");



CREATE INDEX "idx_session_timeline_request" ON "public"."erp_session_timeline" USING "btree" ("request_id");



CREATE INDEX "idx_session_timeline_session" ON "public"."erp_session_timeline" USING "btree" ("session_id");



CREATE INDEX "idx_auth_sessions_expires_at" ON "secure"."auth_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_auth_sessions_user_id" ON "secure"."auth_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_erp_sessions_expiry" ON "secure"."erp_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_erp_sessions_state" ON "secure"."erp_sessions" USING "btree" ("state");



CREATE INDEX "idx_erp_sessions_user" ON "secure"."erp_sessions" USING "btree" ("user_id");



ALTER TABLE ONLY "secure"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "secure"."auth_users"("id") ON DELETE CASCADE;



ALTER TABLE "secure"."auth_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "secure"."auth_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "secure"."erp_sessions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "audit" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "secure" TO "service_role";








































































































































































GRANT ALL ON TABLE "public"."auth_signup_requests" TO "service_role";



GRANT ALL ON TABLE "public"."erp_session_timeline" TO "service_role";



GRANT ALL ON SEQUENCE "public"."erp_session_timeline_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."erp_session_timeline_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."erp_session_timeline_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "secure"."auth_sessions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "secure"."auth_users" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "secure"."erp_sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "audit" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "secure" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";




























drop extension if exists "pg_net";

revoke delete on table "public"."auth_signup_requests" from "anon";

revoke insert on table "public"."auth_signup_requests" from "anon";

revoke references on table "public"."auth_signup_requests" from "anon";

revoke select on table "public"."auth_signup_requests" from "anon";

revoke trigger on table "public"."auth_signup_requests" from "anon";

revoke truncate on table "public"."auth_signup_requests" from "anon";

revoke update on table "public"."auth_signup_requests" from "anon";

revoke delete on table "public"."auth_signup_requests" from "authenticated";

revoke insert on table "public"."auth_signup_requests" from "authenticated";

revoke references on table "public"."auth_signup_requests" from "authenticated";

revoke select on table "public"."auth_signup_requests" from "authenticated";

revoke trigger on table "public"."auth_signup_requests" from "authenticated";

revoke truncate on table "public"."auth_signup_requests" from "authenticated";

revoke update on table "public"."auth_signup_requests" from "authenticated";

revoke delete on table "public"."erp_session_timeline" from "anon";

revoke insert on table "public"."erp_session_timeline" from "anon";

revoke references on table "public"."erp_session_timeline" from "anon";

revoke select on table "public"."erp_session_timeline" from "anon";

revoke trigger on table "public"."erp_session_timeline" from "anon";

revoke truncate on table "public"."erp_session_timeline" from "anon";

revoke update on table "public"."erp_session_timeline" from "anon";

revoke delete on table "public"."erp_session_timeline" from "authenticated";

revoke insert on table "public"."erp_session_timeline" from "authenticated";

revoke references on table "public"."erp_session_timeline" from "authenticated";

revoke select on table "public"."erp_session_timeline" from "authenticated";

revoke trigger on table "public"."erp_session_timeline" from "authenticated";

revoke truncate on table "public"."erp_session_timeline" from "authenticated";

revoke update on table "public"."erp_session_timeline" from "authenticated";


