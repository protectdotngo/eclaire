-- Log de chaque tour de chat (message + réponse complète), à des fins
-- d'analyse manuelle pour ajuster QuickQuestions.tsx. Écriture fire-and-forget
-- uniquement — aucune lecture applicative de cette table.
CREATE TABLE IF NOT EXISTS "test"."chat_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"source" text NOT NULL,
	"user_message" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_chat_logs_session" ON "test"."chat_logs" USING btree ("session_id");
