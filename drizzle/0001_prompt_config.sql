-- Prompt système éditable via /prompt.
-- À exécuter UNE FOIS avec un compte ayant les droits CREATE sur le schéma
-- "test" (l'utilisateur applicatif n'a pas les droits DDL), puis donner les
-- droits DML à l'utilisateur applicatif.
CREATE TABLE IF NOT EXISTS "test"."prompt_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
GRANT SELECT, INSERT ON "test"."prompt_config" TO "eclaire";
