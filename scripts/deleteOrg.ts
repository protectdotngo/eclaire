/**
 * Delete an org and the data that becomes meaningless without it.
 *
 * Run `pnpm delete-org --help` for usage.
 *
 * Why this script exists rather than a hand-written DELETE: `orgs_events.org_id`
 * and `orgs_news.org_id` reference `orgs.id` with no ON DELETE clause, so
 * deleting an org outright fails; and `events`/`news` carry no `org_id`, so
 * deleting only the join rows silently orphans them. Events and news are also
 * n-n, meaning an item can belong to several orgs and must not be taken down
 * with just one of them.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { writeFile } from "node:fs/promises";
import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { db } from "../src/lib/dbDrizzle";
import {
  eventsInTest,
  newsInTest,
  orgsEventsInTest,
  orgsInTest,
  orgsNewsInTest,
  propositionVerificationsInTest,
  propositionsInTest,
} from "../drizzle/schema";
import {
  confirmationMatches,
  formatDeletionPlan,
  formatOrgList,
  isUuid,
  parseArgs,
  type Command,
  type DeletionPlan,
  type OrgListRow,
} from "../src/lib/orgDeletion";

const USAGE = `
Delete an org and its associated data.

  pnpm delete-org --list [filter]          list orgs (id, name, city, counts)
  pnpm delete-org <name|uuid>              DRY RUN: report what would be deleted
  pnpm delete-org <name|uuid> --execute    delete, after confirming the org name

Options
  --confirm <name>   answer the confirmation prompt non-interactively; must
                     equal the org name exactly
  --backup <path>    write the rows being removed to a JSON file first
                     (works in dry-run mode too, as a plain export)
  -h, --help         this message

Kept on purpose: events and news that are also linked to another org.
`.trim();

type Row = Record<string, unknown>;

/** `tx.execute` hands back the raw pg result; we only ever want the rows. */
async function rows<T>(
  tx: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Row[] }> },
  query: ReturnType<typeof sql>,
): Promise<T[]> {
  const result = await tx.execute(query);
  return result.rows as T[];
}

function describeTarget(): string {
  const host = process.env.SCW_DB_HOST ?? "(unset)";
  const port = process.env.SCW_DB_PORT ?? "5432";
  const name = process.env.SCW_DB_NAME ?? "(unset)";
  return `${host}:${port}/${name}, schema "test"`;
}

async function listOrgs(filter: string | null): Promise<void> {
  const where =
    filter === null ? sql`` : sql` where o.name ilike ${"%" + filter + "%"}`;

  const listed = await rows<{
    id: string;
    name: string;
    city: string | null;
    events: number;
    news: number;
  }>(
    db,
    sql`
      select o.id,
             o.name,
             o.city,
             (select count(*)::int from ${orgsEventsInTest} oe
               where oe.org_id = o.id) as events,
             (select count(*)::int from ${orgsNewsInTest} onw
               where onw.org_id = o.id) as news
      from ${orgsInTest} o${where}
      order by o.name
    `,
  );

  console.log(
    formatOrgList(
      listed.map(
        (r): OrgListRow => ({
          id: r.id,
          name: r.name,
          city: r.city,
          events: Number(r.events),
          news: Number(r.news),
        }),
      ),
    ),
  );
}

interface OrgRow {
  id: string;
  name: string;
  city: string | null;
}

/** An event or news item linked to the target, plus how many other orgs claim it. */
interface Candidate {
  id: string;
  other_orgs: number;
}

async function promptForConfirmation(orgName: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const typed = await rl.question(
      `\nType the org name to confirm deletion\n  >>>${orgName}<<<\n> `,
    );
    return confirmationMatches(typed, orgName);
  } finally {
    rl.close();
  }
}

async function deleteOrg(cmd: Extract<Command, { kind: "delete" }>) {
  const { target, execute, confirm, backup } = cmd;

  if (execute && confirm === null && !process.stdin.isTTY) {
    console.error(
      "Refusing to delete without confirmation: stdin is not a terminal.\n" +
        `Re-run with --confirm "<exact org name>".`,
    );
    return 1;
  }

  // Deliberately READ COMMITTED, not SERIALIZABLE. The org-row FOR UPDATE below
  // already blocks the n8n scraper from adding links to this org (its FK check
  // needs FOR KEY SHARE on that row), and a serialization failure would leave us
  // with no safe retry once the operator has already typed the confirmation.
  const runInTransaction = execute
    ? db.transaction.bind(db)
    : (fn: Parameters<typeof db.transaction>[0]) =>
        db.transaction(fn, { accessMode: "read only" });

  let exitCode = 0;

  await runInTransaction(async (tx) => {
    // A deletion that cannot get its locks should fail rather than sit on an
    // exclusive lock against the scraper.
    await tx.execute(sql`set local lock_timeout = '5s'`);
    await tx.execute(sql`set local statement_timeout = '60s'`);

    // FOR UPDATE only in execute mode: a read-only transaction rejects it, and
    // a dry run has no business blocking the scraper.
    const lock = execute ? sql` for update` : sql``;

    // limit 2, not 1: `orgs_name_unique` is only attested by a migration file
    // that is known to be stale, so ambiguity must be detected, not assumed away.
    const matches = await rows<OrgRow>(
      tx,
      sql`
        select id, name, city from ${orgsInTest}
        where ${isUuid(target) ? sql`id = ${target}::uuid` : sql`name = ${target}`}
        limit 2${lock}
      `,
    );

    if (matches.length === 0) {
      console.error(`No org matches ${JSON.stringify(target)}.`);
      const near = await rows<{ id: string; name: string }>(
        tx,
        sql`select id, name from ${orgsInTest}
            where name ilike ${"%" + target + "%"} order by name limit 10`,
      );
      if (near.length > 0) {
        console.error("\nDid you mean:");
        for (const n of near) console.error(`  ${n.id}  ${n.name}`);
      } else {
        console.error("Run `pnpm delete-org --list` to see the orgs.");
      }
      exitCode = 1;
      return;
    }
    if (matches.length > 1) {
      console.error(
        `${JSON.stringify(target)} matches more than one org. Pass a UUID instead.`,
      );
      exitCode = 1;
      return;
    }

    const org = matches[0]!;
    const orgId = org.id;

    // Ownership is settled here, before anything is deleted. The predicate is
    // "linked to this org and to no other" — never "has no links at all", which
    // would also sweep up an event the scraper inserted seconds ago whose join
    // row is not written yet.
    const eventCandidates = await rows<Candidate>(
      tx,
      sql`
        select e.id,
               (select count(*)::int from ${orgsEventsInTest} x
                 where x.event_id = e.id and x.org_id <> ${orgId}) as other_orgs
        from ${eventsInTest} e
        where exists (select 1 from ${orgsEventsInTest} oe
                       where oe.event_id = e.id and oe.org_id = ${orgId})
        order by e.id${lock}
      `,
    );
    const newsCandidates = await rows<Candidate>(
      tx,
      sql`
        select n.id,
               (select count(*)::int from ${orgsNewsInTest} x
                 where x.news_id = n.id and x.org_id <> ${orgId}) as other_orgs
        from ${newsInTest} n
        where exists (select 1 from ${orgsNewsInTest} onw
                       where onw.news_id = n.id and onw.org_id = ${orgId})
        order by n.id${lock}
      `,
    );

    const orphanEventIds = eventCandidates
      .filter((c) => Number(c.other_orgs) === 0)
      .map((c) => c.id);
    const orphanNewsIds = newsCandidates
      .filter((c) => Number(c.other_orgs) === 0)
      .map((c) => c.id);

    // Counted against the join tables rather than derived from the candidate
    // lists, which are DISTINCT by construction (they select from events/news).
    const [linkCounts] = await rows<{ events: number; news: number }>(
      tx,
      sql`
        select (select count(*)::int from ${orgsEventsInTest} oe
                 where oe.org_id = ${orgId}) as events,
               (select count(*)::int from ${orgsNewsInTest} onw
                 where onw.org_id = ${orgId}) as news
      `,
    );
    const linkedEvents = Number(linkCounts?.events ?? 0);
    const linkedNews = Number(linkCounts?.news ?? 0);

    const propRows = await rows<{ id: string; status: string }>(
      tx,
      sql`select id, status from ${propositionsInTest}
          where modifying_org_id = ${orgId} order by id${lock}`,
    );
    const propIds = propRows.map((p) => p.id);

    const plan: DeletionPlan = {
      org,
      linkedEvents,
      orphanEvents: orphanEventIds.length,
      linkedNews,
      orphanNews: orphanNewsIds.length,
      propositions: propIds.length,
    };

    console.log(execute ? "MODE  execute\n" : "MODE  dry run\n");
    console.log(formatDeletionPlan(plan));

    // Submissions that name this org but target nothing (typically the
    // `action = 'add'` one that created it) are left alone — they are the
    // moderation trail, and nulling or deleting them is not this script's call.
    const namesake = await rows<{
      id: string;
      action: string | null;
      status: string;
    }>(
      tx,
      sql`select id, action, status from ${propositionsInTest}
          where modifying_org_id is null
            and lower(btrim(name)) = lower(btrim(${org.name}))
          order by submitted_at`,
    );
    if (namesake.length > 0) {
      console.log(
        `\nLeft untouched: ${namesake.length} proposition(s) naming "${org.name}" ` +
          `with no modifying_org_id (the submissions that created it):`,
      );
      for (const p of namesake) {
        console.log(`  ${p.id}  action=${p.action ?? "—"}  status=${p.status}`);
      }
    }

    if (!execute) {
      if (backup !== null) {
        await writeBackup(
          backup,
          tx,
          org,
          orphanEventIds,
          orphanNewsIds,
          propIds,
        );
      }
      console.log(
        "\nDRY RUN — nothing was deleted. Counts are a plan as of now; the" +
          " execute run re-plans and reports what it actually removed.",
      );
      console.log("Re-run with --execute to delete.");
      return;
    }

    const confirmed =
      confirm !== null
        ? confirmationMatches(confirm, org.name)
        : await promptForConfirmation(org.name);
    if (!confirmed) {
      console.error("\nConfirmation did not match the org name. Aborted.");
      exitCode = 1;
      // Only SELECTs have run, so returning lets an empty transaction commit.
      // Calling tx.rollback() would make drizzle throw on the way out.
      return;
    }

    // Written after the confirmation so a refused deletion leaves no file
    // implying rows were removed, but before the deletes so it reflects the
    // locked snapshot exactly.
    if (backup !== null) {
      await writeBackup(
        backup,
        tx,
        org,
        orphanEventIds,
        orphanNewsIds,
        propIds,
      );
    }

    // Verifications would cascade from propositions, but deleting them
    // explicitly gives us a count to report.
    const delVerifications =
      propIds.length === 0
        ? []
        : await tx
            .delete(propositionVerificationsInTest)
            .where(
              inArray(propositionVerificationsInTest.propositionId, propIds),
            )
            .returning({ id: propositionVerificationsInTest.id });

    const delProps =
      propIds.length === 0
        ? []
        : await tx
            .delete(propositionsInTest)
            .where(inArray(propositionsInTest.id, propIds))
            .returning({ id: propositionsInTest.id });

    const delEventLinks = await tx
      .delete(orgsEventsInTest)
      .where(eq(orgsEventsInTest.orgId, orgId))
      .returning({ eventId: orgsEventsInTest.eventId });

    // News links must go before the news rows: orgs_news.news_id has no cascade.
    const delNewsLinks = await tx
      .delete(orgsNewsInTest)
      .where(eq(orgsNewsInTest.orgId, orgId))
      .returning({ newsId: orgsNewsInTest.newsId });

    // The NOT EXISTS re-guard is what makes the ON DELETE CASCADE on
    // orgs_events.event_id harmless: if another org claimed one of these events
    // since we planned, the delete skips it instead of cascading away that new
    // link.
    const delEvents = await tx
      .delete(eventsInTest)
      .where(
        and(
          inArray(eventsInTest.id, orphanEventIds),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(orgsEventsInTest)
              .where(eq(orgsEventsInTest.eventId, eventsInTest.id)),
          ),
        ),
      )
      .returning({ id: eventsInTest.id });

    const delNews = await tx
      .delete(newsInTest)
      .where(
        and(
          inArray(newsInTest.id, orphanNewsIds),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(orgsNewsInTest)
              .where(eq(orgsNewsInTest.newsId, newsInTest.id)),
          ),
        ),
      )
      .returning({ id: newsInTest.id });

    // Last, so the NO ACTION FKs on orgs_events/orgs_news act as a completeness
    // check: anything still pointing at this org aborts the whole transaction.
    const delOrg = await tx
      .delete(orgsInTest)
      .where(eq(orgsInTest.id, orgId))
      .returning({ id: orgsInTest.id, name: orgsInTest.name });

    if (delOrg.length !== 1) {
      throw new Error(
        `Expected to delete exactly 1 org, deleted ${delOrg.length}. Rolling back.`,
      );
    }
    if (
      delEventLinks.length !== linkedEvents ||
      delNewsLinks.length !== linkedNews
    ) {
      throw new Error(
        `Join-row count changed under us (events ${delEventLinks.length}/${linkedEvents},` +
          ` news ${delNewsLinks.length}/${linkedNews}). Rolling back.`,
      );
    }
    if (
      delEvents.length > orphanEventIds.length ||
      delNews.length > orphanNewsIds.length
    ) {
      throw new Error("Deleted more rows than planned. Rolling back.");
    }

    console.log("\nDeleted");
    console.log(`  events                     ${delEvents.length}`);
    console.log(`  news                       ${delNews.length}`);
    console.log(`  orgs_events                ${delEventLinks.length}`);
    console.log(`  orgs_news                  ${delNewsLinks.length}`);
    console.log(`  propositions               ${delProps.length}`);
    console.log(`  proposition_verifications  ${delVerifications.length}`);
    console.log(`  orgs                       ${delOrg.length}`);

    // Not fatal: the re-guard fired, which is it doing its job.
    const skippedEvents = orphanEventIds.length - delEvents.length;
    const skippedNews = orphanNewsIds.length - delNews.length;
    if (skippedEvents > 0 || skippedNews > 0) {
      console.log(
        `\nSkipped ${skippedEvents} event(s) and ${skippedNews} news item(s) that` +
          " gained another org between planning and deletion. Nothing was lost.",
      );
    }

    console.log(`\nCommitted. "${org.name}" is gone.`);
    console.log(
      [
        "",
        "Before you consider this done:",
        "  1. n8n owns org ingestion and will re-insert this org (with a new",
        "     UUID) on its next run. Remove it from the scrape config too.",
        "  2. The site caches orgs in-process: 60s for the map and calendar",
        "     APIs, 5min for the chat's org list. It can still appear briefly.",
        backup === null
          ? "  3. There is no undo and you did not pass --backup."
          : `  3. Rows removed were written to ${backup} (reconstruction aid, not an undo).`,
      ].join("\n"),
    );
  });

  return exitCode;
}

async function writeBackup(
  path: string,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  org: OrgRow,
  eventIds: string[],
  newsIds: string[],
  propIds: string[],
): Promise<void> {
  // Embeddings are excluded: 1024 floats per row, regenerable by the scraper,
  // and they would dwarf everything worth reading in here. Selected through
  // drizzle rather than a raw `= any($1)`: the sql template splices a JS array
  // into one parameter per element, which Postgres rejects as an array literal.
  const payload = {
    note:
      "Rows removed by scripts/deleteOrg.ts. A reconstruction aid, not an undo:" +
      " re-inserting may collide with orgs_name_unique / events_url_unique /" +
      " news_url_unique if the scraper has recreated them. Embeddings omitted.",
    deletedAt: new Date().toISOString(),
    org: await tx
      .select({
        id: orgsInTest.id,
        name: orgsInTest.name,
        desc: orgsInTest.desc,
        categories: orgsInTest.categories,
        domain: orgsInTest.domain,
        eventsUrl: orgsInTest.eventsUrl,
        newsUrl: orgsInTest.newsUrl,
        socials: orgsInTest.socials,
        address: orgsInTest.address,
        lat: orgsInTest.lat,
        lon: orgsInTest.lon,
        city: orgsInTest.city,
        rss: orgsInTest.rss,
        contact: orgsInTest.contact,
      })
      .from(orgsInTest)
      .where(eq(orgsInTest.id, org.id)),
    events: await tx
      .select({
        id: eventsInTest.id,
        url: eventsInTest.url,
        title: eventsInTest.title,
        content: eventsInTest.content,
        location: eventsInTest.location,
        scrapedAt: eventsInTest.scrapedAt,
        startDate: eventsInTest.startDate,
        endDate: eventsInTest.endDate,
        categories: eventsInTest.categories,
        baseUrl: eventsInTest.baseUrl,
      })
      .from(eventsInTest)
      .where(inArray(eventsInTest.id, eventIds)),
    news: await tx
      .select({
        id: newsInTest.id,
        url: newsInTest.url,
        title: newsInTest.title,
        content: newsInTest.content,
        pubDate: newsInTest.pubDate,
        scrapedAt: newsInTest.scrapedAt,
      })
      .from(newsInTest)
      .where(inArray(newsInTest.id, newsIds)),
    propositions: await tx
      .select()
      .from(propositionsInTest)
      .where(inArray(propositionsInTest.id, propIds)),
    propositionVerifications: await tx
      .select()
      .from(propositionVerificationsInTest)
      .where(inArray(propositionVerificationsInTest.propositionId, propIds)),
  };

  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\nBackup written to ${path}`);
}

async function main(): Promise<number> {
  const cmd = parseArgs(process.argv.slice(2));

  if (cmd.kind === "help") {
    console.log(USAGE);
    return 0;
  }
  if (cmd.kind === "error") {
    console.error(`${cmd.message}\n\n${USAGE}`);
    return 1;
  }

  console.log(`DB    ${describeTarget()}\n`);

  if (cmd.kind === "list") {
    await listOrgs(cmd.filter);
    return 0;
  }
  return deleteOrg(cmd);
}

try {
  process.exitCode = await main();
} catch (err) {
  // 23503 means a table references orgs that this script does not know about;
  // the constraint name is what tells the next maintainer where to look.
  const cause = (err as { cause?: { code?: string; constraint?: string } })
    ?.cause;
  if (cause?.code === "23503") {
    console.error(
      `\nForeign-key violation on ${cause.constraint ?? "an unknown constraint"}.` +
        " Something still references this org. Nothing was deleted.",
    );
  } else if (cause?.code === "55P03") {
    // The likeliest real-world failure: a scrape is mid-run and holds the org
    // row, or another copy of this script is running.
    console.error(
      "\nTimed out waiting for a lock on this org — something else is writing" +
        " to it right now (an n8n scrape, most likely). Nothing was deleted;" +
        " try again in a minute.",
    );
  } else if (cause?.code === "57014") {
    console.error(
      "\nStatement timed out after 60s. Nothing was deleted. If this org really" +
        " has that much data, raise statement_timeout in the script.",
    );
  } else {
    console.error("\nFailed, nothing was deleted:", err);
  }
  process.exitCode = 1;
} finally {
  // dbDrizzle.ts never closes its pool, so the process would hang otherwise.
  // $client is drizzle's typed handle on the underlying pg.Pool.
  await db.$client.end();
}
