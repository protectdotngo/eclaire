import "dotenv/config";
import type { APIRoute } from "astro";
import { and, desc, eq, ne, or, isNull } from "drizzle-orm";
import { db } from "../../lib/dbDrizzle";
import {
  propositionsInTest,
  propositionVerificationsInTest,
  orgsInTest,
} from "../../../drizzle/schema";
import {
  ORG_FIELDS,
  ARRAY_FIELDS,
  type OrgField,
  type WritePayload,
} from "../../interfaces/verification";

const PROP_COL: Record<OrgField, keyof typeof propositionsInTest.$inferInsert> =
  {
    name: "name",
    desc: "desc",
    categories: "categories",
    domain: "domain",
    address: "address",
    city: "city",
    rss: "rss",
    events_url: "eventsUrl",
    news_url: "newsUrl",
    socials: "socials",
    contact: "contact",
  };

const ORG_COL: Record<OrgField, keyof typeof orgsInTest.$inferInsert> = {
  name: "name",
  desc: "desc",
  categories: "categories",
  domain: "domain",
  address: "address",
  city: "city",
  rss: "rss",
  events_url: "eventsUrl",
  news_url: "newsUrl",
  socials: "socials",
  contact: "contact",
};

function toFieldNameSet(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get("id");
  if (id) return getDetail(id);
  return getList();
};

async function getList(): Promise<Response> {
  try {
    const rows = await db
      .select({
        verificationId: propositionVerificationsInTest.id,
        propositionId: propositionsInTest.id,
        action: propositionsInTest.action,
        modifyingOrgId: propositionsInTest.modifyingOrgId,
        orgName: propositionsInTest.name,
        submitterEmail: propositionsInTest.submitterEmail,
        legitimacyScore: propositionVerificationsInTest.legitimacyScore,
        verdict: propositionVerificationsInTest.verdict,
        processingStatus: propositionVerificationsInTest.processingStatus,
        status: propositionsInTest.status,
        createdAt: propositionVerificationsInTest.createdAt,
      })
      .from(propositionVerificationsInTest)
      .innerJoin(
        propositionsInTest,
        eq(propositionVerificationsInTest.propositionId, propositionsInTest.id),
      )
      .where(
        and(
          or(
            ne(propositionVerificationsInTest.verdict, "rejected"),
            isNull(propositionVerificationsInTest.verdict),
          ),
          ne(propositionsInTest.status, "published"),
          ne(propositionsInTest.status, "rejected"),
        ),
      )
      .orderBy(desc(propositionVerificationsInTest.createdAt))
      .limit(200);
    return json({ items: rows });
  } catch (err) {
    console.error("Failed to list verifications:", err);
    if ((err as { cause?: { code?: string } })?.cause?.code === "42P01") {
      return json(
        {
          error:
            "The test.proposition_verifications table is missing — run the n8n verification workflow first.",
        },
        500,
      );
    }
    return json({ error: "Échec du chargement" }, 500);
  }
}

async function getDetail(verificationId: string): Promise<Response> {
  const [row] = await db
    .select()
    .from(propositionVerificationsInTest)
    .innerJoin(
      propositionsInTest,
      eq(propositionVerificationsInTest.propositionId, propositionsInTest.id),
    )
    .where(eq(propositionVerificationsInTest.id, verificationId))
    .limit(1);

  if (!row) return json({ error: "Vérification introuvable" }, 404);

  const v = row.proposition_verifications;
  const p = row.propositions;

  const values = {} as Record<OrgField, string[] | string | null>;
  for (const f of ORG_FIELDS) {
    values[f] = p[PROP_COL[f]] as string[] | string | null;
  }

  return json({
    verificationId: v.id,
    verdict: v.verdict,
    legitimacyScore: v.legitimacyScore,
    notes: v.notes,
    confirmedByWeb: toFieldNameSet(v.confirmedByWeb),
    suspiciousChanges: toFieldNameSet(v.suspiciousChanges),
    propositionId: p.id,
    action: p.action,
    modifyingOrgId: p.modifyingOrgId,
    status: p.status,
    submitterName: p.submitterName,
    submitterEmail: p.submitterEmail,
    adminEditor: p.adminEditor,
    adminEditedAt: p.adminEditedAt,
    values,
    original: (p.originalSubmission as Record<string, unknown> | null) ?? null,
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: WritePayload;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }

  const verificationId = body.verificationId;
  if (typeof verificationId !== "string") {
    return json({ error: "verificationId manquant" }, 400);
  }

  const adminEditor = body.adminEditor;
  if (typeof adminEditor !== "string" || !isEmail(adminEditor)) {
    return json({ error: "Email de l'admin requis (admin_editor)" }, 400);
  }

  const rawFields =
    body.fields && typeof body.fields === "object"
      ? (body.fields as Record<string, unknown>)
      : {};

  const fields = {} as Record<OrgField, string[] | string | null>;
  for (const f of ORG_FIELDS) {
    if (!(f in rawFields)) continue;
    const val = rawFields[f];
    if (ARRAY_FIELDS.includes(f)) {
      fields[f] = Array.isArray(val)
        ? val.map((x) => String(x).trim()).filter(Boolean)
        : typeof val === "string"
          ? val
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
          : [];
    } else {
      fields[f] =
        typeof val === "string" ? val : val == null ? null : String(val);
    }
  }

  const [row] = await db
    .select({
      propositionId: propositionsInTest.id,
      action: propositionsInTest.action,
      modifyingOrgId: propositionsInTest.modifyingOrgId,
      status: propositionsInTest.status,
    })
    .from(propositionVerificationsInTest)
    .innerJoin(
      propositionsInTest,
      eq(propositionVerificationsInTest.propositionId, propositionsInTest.id),
    )
    .where(eq(propositionVerificationsInTest.id, verificationId))
    .limit(1);

  if (!row) return json({ error: "Vérification introuvable" }, 404);
  if (row.status === "published") {
    return json({ error: "Cette proposition a déjà été publiée." }, 409);
  }
  if (row.status === "rejected") {
    return json({ error: "Cette proposition a déjà été rejetée." }, 409);
  }

  const nowEdit = {
    adminEditor,
    adminEditedAt: new Date().toISOString(),
  };

  if (body.reject === true) {
    try {
      await db
        .update(propositionsInTest)
        .set({ status: "rejected", approved: false, ...nowEdit })
        .where(eq(propositionsInTest.id, row.propositionId));
      return json({ ok: true, mode: "rejected" });
    } catch (err) {
      console.error("Failed to reject proposition:", err);
      return json({ error: "Échec du rejet" }, 500);
    }
  }

  if (body.publish !== true) {
    try {
      await db
        .update(propositionsInTest)
        .set({ ...mapPropUpdate(fields), ...nowEdit })
        .where(eq(propositionsInTest.id, row.propositionId));
      return json({ ok: true, mode: "saved" });
    } catch (err) {
      console.error("Failed to save proposition edits:", err);
      return json({ error: "Échec de l'enregistrement" }, 500);
    }
  }

  try {
    await db
      .update(propositionsInTest)
      .set({ ...mapPropUpdate(fields), ...nowEdit })
      .where(eq(propositionsInTest.id, row.propositionId));

    if (row.action === "modify") {
      if (!row.modifyingOrgId) {
        return json(
          { error: "Proposition de modification sans org de référence." },
          400,
        );
      }
      const [org] = await db
        .select()
        .from(orgsInTest)
        .where(eq(orgsInTest.id, row.modifyingOrgId))
        .limit(1);
      if (!org) {
        return json({ error: "L'org référencée n'existe plus." }, 400);
      }

      const diff: Record<string, unknown> = {};
      for (const f of ORG_FIELDS) {
        if (!(f in fields)) continue;
        const proposed = fields[f];
        const current = org[ORG_COL[f]] as unknown;
        if (!valuesEqual(proposed, current)) {
          diff[ORG_COL[f] as string] = proposed;
        }
      }

      if (Object.keys(diff).length === 0) {
        await markPublished(row.propositionId);
        return json({ ok: true, mode: "published", changed: 0 });
      }

      await db
        .update(orgsInTest)
        .set(diff)
        .where(eq(orgsInTest.id, row.modifyingOrgId));
      await markPublished(row.propositionId);
      return json({
        ok: true,
        mode: "published",
        changed: Object.keys(diff).length,
      });
    }

    const insertVals: Record<string, unknown> = {};
    for (const f of ORG_FIELDS) {
      insertVals[ORG_COL[f] as string] =
        fields[f] ?? (ARRAY_FIELDS.includes(f) ? [] : null);
    }
    if (!insertVals.name || !insertVals.desc) {
      return json(
        { error: "Nom et description obligatoires pour créer une org." },
        400,
      );
    }
    if (
      !Array.isArray(insertVals.categories) ||
      (insertVals.categories as unknown[]).length === 0
    ) {
      return json({ error: "Au moins une catégorie est obligatoire." }, 400);
    }

    const [created] = await db
      .insert(orgsInTest)
      .values(insertVals as typeof orgsInTest.$inferInsert)
      .returning({ id: orgsInTest.id });
    await markPublished(row.propositionId);
    return json({ ok: true, mode: "published", orgId: created.id });
  } catch (err) {
    console.error("Failed to publish proposition:", err);
    return json({ error: "Échec de la publication" }, 500);
  }
};

async function markPublished(propositionId: string): Promise<void> {
  await db
    .update(propositionsInTest)
    .set({ status: "published", approved: true })
    .where(eq(propositionsInTest.id, propositionId));
}

function mapPropUpdate(
  fields: Record<OrgField, string[] | string | null>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of ORG_FIELDS) {
    if (f in fields) out[PROP_COL[f] as string] = fields[f];
  }
  return out;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => x === b[i]);
  }
  const na = a == null || a === "" ? null : a;
  const nb = b == null || b === "" ? null : b;
  return na === nb;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
