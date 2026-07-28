-- Prompt système éditable via /prompt.
-- DÉJÀ APPLIQUÉ sur l'instance pgvector (db "eclaire") le 2026-07-28 :
-- table créée par l'utilisateur "eclaire" (owner), qui a donc tous les droits.
-- Conservé ici comme référence pour recréer l'environnement.
CREATE TABLE IF NOT EXISTS "test"."prompt_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
