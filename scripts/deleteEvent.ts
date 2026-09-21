/**
 * Delete events — one by one, or by collapsing scraper duplicates.
 *
 * Run `pnpm delete-event --help` for usage.
 *
 * Simpler than deleteOrg by design: `orgs_events.event_id` references
 * `events.id` ON DELETE CASCADE and nothing else references `events`, so the
 * join rows go on their own and there is no orphan-hunting to do. They are
 * still deleted explicitly, to report a count and to keep the statement order
 * obvious to the next reader.
 *
 * The care here goes elsewhere: an event can belong to several orgs, so
 * deleting one copy of a duplicate can cost an org its only link to that event.
 * `--duplicates` refuses to touch a group where that would happen.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { writeFile } from "node:fs/promises";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/lib/dbDrizzle";
import { eventsInTest, orgsEventsInTest, orgsInTest } from "../drizzle/schema";
import {
  confirmationMatches,
  confirmationToken,
  countRedundant,
  formatDuplicatePlan,
  formatEventDeletionPlan,
  formatEventList,
  isUuid,
  parseArgs,
  planDuplicateGroup,
  type Command,
  type DuplicateCopy,
  type DuplicateGroup,
  type EventDeletionPlan,
  type EventListRow,
  type SkippedDuplicateGroup,
} from "../src/lib/eventDeletion";

const USAGE = `
Delete events, or collapse scraper duplicates.

  pnpm delete-event --list [filter]         list events (id, date, title, orgs)
  pnpm delete-event <title|uuid>            DRY RUN: report what would be deleted
  pnpm delete-event <title|uuid> --execute  delete, after confirming the title
  pnpm delete-event --duplicates            DRY RUN: report duplicate groups
  pnpm delete-event --duplicates --execute  collapse them, keeping one copy each

Options
  --confirm <value>  answer the confirmation prompt non-interactively; the exact
                     event title (or its id, when the title is empty), or for
                     --duplicates the exact number of rows to be deleted
  --backup <path>    write the rows being removed to a JSON file first
                     (works in dry-run mode too, as a plain export)
  -h, --help         this message

A title that matches several events is not deleted: the matches are printed so
you can pass the right UUID. Duplicates are matched on identical title AND start
date; the best-connected copy survives.
`.trim();

// Listing every event would print 2 900 lines; a filter is the normal path.
const LIST_LIMIT = 200;

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

interface EventRow {
  id: string;
  title: string | null;
  start_date: string | null;
  url: string;
  orgs: string[] | null;
}

/** Events plus their org names, the shape every listing in here wants. */
function selectEvents(
  where: ReturnType<typeof sql>,
  limit: ReturnType<typeof sql>,
) {
  return sql`
    select e.id, e.title, e.start_date, e.url,
           (select array_agg(o.name order by o.name)
              from ${orgsEventsInTest} oe
              join ${orgsInTest} o on o.id = oe.org_id
             where oe.event_id = e.id) as orgs
    from ${eventsInTest} e
    ${where}
    order by e.start_date desc nulls last, e.id
    ${limit}
  `;
}

function toListRow(r: EventRow): EventListRow {
  return {
    id: r.id,
    title: r.title,
    startDate: r.start_date,
    orgs: r.orgs ?? [],
  };
}

async function listEvents(filter: string | null): Promise<void> {
  const where =
    filter === null ? sql`` : sql`where e.title ilike ${"%" + filter + "%"}`;

  const listed = await rows<EventRow>(
    db,
    selectEvents(where, sql`limit ${LIST_LIMIT + 1}`),
  );

  const truncated = listed.length > LIST_LIMIT;
  const shown = truncated ? listed.slice(0, LIST_LIMIT) : listed;
  console.log(formatEventList(shown.map(toListRow)));

  if (truncated) {
    console.log(
      `\nStopped at ${LIST_LIMIT}. Narrow it down with \`pnpm delete-event --list "<filter>"\`.`,
    );
  }
}

async function promptForConfirmation(
  expected: string,
  what: string,
): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const typed = await rl.question(
      `\nType ${what} to confirm deletion\n  >>>${expected}<<<\n> `,
    );
    return confirmationMatches(typed, expected);
  } finally {
    rl.close();
  }
}

function refusedNonInteractive(what: string): void {
  console.error(
    "Refusing to delete without confirmation: stdin is not a terminal.\n" +
      `Re-run with --confirm "${what}".`,
  );
}

/** Read-only transactions in dry-run mode; see deleteOrg for why not SERIALIZABLE. */
function runner(execute: boolean) {
  return execute
    ? db.transaction.bind(db)
    : (fn: Parameters<typeof db.transaction>[0]) =>
        db.transaction(fn, { accessMode: "read only" });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function setTimeouts(tx: Tx): Promise<void> {
  // A deletion that cannot get its locks should fail rather than sit on an
  // exclusive lock against the n8n scraper.
  await tx.execute(sql`set local lock_timeout = '5s'`);
  await tx.execute(sql`set local statement_timeout = '60s'`);
}

async function deleteEvent(cmd: Extract<Command, { kind: "delete" }>) {
  const { target, execute, confirm, backup } = cmd;

  if (execute && confirm === null && !process.stdin.isTTY) {
    refusedNonInteractive("<exact event title>");
    return 1;
  }

  let exitCode = 0;

  await runner(execute)(async (tx) => {
    await setTimeouts(tx);

    // FOR UPDATE only in execute mode: a read-only transaction rejects it, and
    // a dry run has no business blocking the scraper.
    const lock = execute ? sql` for update` : sql``;

    // limit 11, not 2: unlike org names, duplicate event titles are the norm
    // here, so showing the operator the candidates beats telling them there
    // were several.
    const where = isUuid(target)
      ? sql`where e.id = ${target}::uuid`
      : sql`where e.title = ${target}`;
    const matches = await rows<EventRow>(
      tx,
      // The lock rides on the outer select; `selectEvents` already orders.
      sql`${selectEvents(where, sql`limit 11`)}${lock}`,
    );

    if (matches.length === 0) {
      console.error(`No event matches ${JSON.stringify(target)}.`);
      const near = await rows<EventRow>(
        tx,
        selectEvents(
          sql`where e.title ilike ${"%" + target + "%"}`,
          sql`limit 10`,
        ),
      );
      if (near.length > 0) {
        console.error("\nDid you mean:");
        console.error(formatEventList(near.map(toListRow)));
      } else {
        console.error("Run `pnpm delete-event --list` to see the events.");
      }
      exitCode = 1;
      return;
    }
    if (matches.length > 1) {
      console.error(
        `${JSON.stringify(target)} matches ${matches.length > 10 ? "more than 10" : matches.length} events.` +
          " Pass one of these UUIDs, or use --duplicates to collapse them:\n",
      );
      console.error(formatEventList(matches.slice(0, 10).map(toListRow)));
      exitCode = 1;
      return;
    }

    const event = matches[0]!;
    const orgs = event.orgs ?? [];
    const plan: EventDeletionPlan = {
      event: {
        id: event.id,
        title: event.title,
        startDate: event.start_date,
        url: event.url,
      },
      links: orgs.length,
      orgs,
    };

    console.log(execute ? "MODE  execute\n" : "MODE  dry run\n");
    console.log(formatEventDeletionPlan(plan));

    if (!execute) {
      if (backup !== null) await writeBackup(backup, tx, [event.id]);
      console.log(
        "\nDRY RUN — nothing was deleted." +
          "\nRe-run with --execute to delete.",
      );
      return;
    }

    const expected = confirmationToken(event);
    const confirmed =
      confirm !== null
        ? confirmationMatches(confirm, expected)
        : await promptForConfirmation(expected, "the event title");
    if (!confirmed) {
      console.error("\nConfirmation did not match the event title. Aborted.");
      exitCode = 1;
      // Only SELECTs have run, so returning lets an empty transaction commit.
      // Calling tx.rollback() would make drizzle throw on the way out.
      return;
    }

    // Written after the confirmation so a refused deletion leaves no file
    // implying rows were removed, but before the deletes so it reflects the
    // locked snapshot exactly.
    if (backup !== null) await writeBackup(backup, tx, [event.id]);

    const removed = await removeEvents(tx, [event.id]);
    console.log("\nDeleted");
    console.log(`  events         ${removed.events}`);
    console.log(`  orgs_events    ${removed.links}`);

    if (removed.events !== 1) {
      throw new Error(
        `Expected to delete exactly 1 event, deleted ${removed.events}. Rolling back.`,
      );
    }

    console.log(`\nCommitted. "${expected}" is gone.`);
    console.log(afterword(backup));
  });

  return exitCode;
}

interface GroupRow {
  title: string | null;
  start_date: string | null;
  ids: string[];
  scraped_ats: string[];
}

async function deleteDuplicates(cmd: Extract<Command, { kind: "duplicates" }>) {
  const { execute, confirm, backup } = cmd;

  if (execute && confirm === null && !process.stdin.isTTY) {
    refusedNonInteractive("<number of rows to delete>");
    return 1;
  }

  let exitCode = 0;

  await runner(execute)(async (tx) => {
    await setTimeouts(tx);

    // Same title AND same start date. Title alone would collapse the weekly
    // "Cuisine et Partage" sessions, which are distinct events.
    const groupRows = await rows<GroupRow>(
      tx,
      sql`
        select e.title,
               e.start_date,
               array_agg(e.id::text order by e.id) as ids,
               array_agg(e.scraped_at::text order by e.id) as scraped_ats
        from ${eventsInTest} e
        group by e.title, e.start_date
        having count(*) > 1
        order by e.start_date desc nulls last
      `,
    );

    const allIds = groupRows.flatMap((g) => g.ids);
    const linksByEvent = new Map<string, string[]>();
    if (allIds.length > 0) {
      const links = await tx
        .select({
          eventId: orgsEventsInTest.eventId,
          orgId: orgsEventsInTest.orgId,
        })
        .from(orgsEventsInTest)
        .where(inArray(orgsEventsInTest.eventId, allIds));
      for (const l of links) {
        const list = linksByEvent.get(l.eventId);
        if (list) list.push(l.orgId);
        else linksByEvent.set(l.eventId, [l.orgId]);
      }
    }

    const clean: DuplicateGroup[] = [];
    const skipped: SkippedDuplicateGroup[] = [];

    for (const g of groupRows) {
      const copies: DuplicateCopy[] = g.ids.map((id, i) => ({
        id,
        scrapedAt: g.scraped_ats[i] ?? "",
        orgIds: linksByEvent.get(id) ?? [],
      }));
      const decision = planDuplicateGroup(copies);
      if (decision.kind === "skip") {
        skipped.push({
          title: g.title,
          startDate: g.start_date,
          copies: copies.length,
          orphanedOrgIds: decision.orphanedOrgIds,
        });
      } else {
        clean.push({
          title: g.title,
          startDate: g.start_date,
          keepId: decision.keepId,
          deleteIds: decision.deleteIds,
        });
      }
    }

    console.log(execute ? "MODE  execute\n" : "MODE  dry run\n");
    console.log(formatDuplicatePlan(clean, skipped));

    const doomed = clean.flatMap((g) => g.deleteIds);
    const redundant = countRedundant(clean);

    if (!execute) {
      if (backup !== null) await writeBackup(backup, tx, doomed);
      console.log(
        "\nDRY RUN — nothing was deleted." +
          "\nRe-run with --execute to collapse these groups.",
      );
      return;
    }

    if (redundant === 0) {
      console.log("\nNothing to delete.");
      return;
    }

    // The count, not a title: it is the one value the operator can only supply
    // by having read the plan above.
    const expected = String(redundant);
    const confirmed =
      confirm !== null
        ? confirmationMatches(confirm, expected)
        : await promptForConfirmation(expected, "the number of rows to delete");
    if (!confirmed) {
      console.error("\nConfirmation did not match the row count. Aborted.");
      exitCode = 1;
      return;
    }

    if (backup !== null) await writeBackup(backup, tx, doomed);

    // Re-lock the doomed rows before deleting: the plan was read without FOR
    // UPDATE (the group query aggregates, which cannot lock), so a scrape could
    // have attached a new org link since. The guard below catches that.
    const relinked = await tx
      .select({ eventId: orgsEventsInTest.eventId })
      .from(orgsEventsInTest)
      .where(inArray(orgsEventsInTest.eventId, doomed));
    const expectedLinks = doomed.reduce(
      (n, id) => n + (linksByEvent.get(id)?.length ?? 0),
      0,
    );
    if (relinked.length !== expectedLinks) {
      throw new Error(
        `Org links on the doomed copies changed under us (${relinked.length} now,` +
          ` ${expectedLinks} when planned). Rolling back; re-run to re-plan.`,
      );
    }

    const removed = await removeEvents(tx, doomed);
    if (removed.events !== redundant) {
      throw new Error(
        `Expected to delete ${redundant} events, deleted ${removed.events}. Rolling back.`,
      );
    }

    console.log("\nDeleted");
    console.log(`  events         ${removed.events}`);
    console.log(`  orgs_events    ${removed.links}`);
    console.log(
      `\nCommitted. ${clean.length} group(s) collapsed to one copy each.`,
    );
    console.log(afterword(backup));
  });

  return exitCode;
}

/**
 * Delete events and their join rows. The join rows would cascade, but deleting
 * them first gives a count to report and keeps the order explicit.
 */
async function removeEvents(
  tx: Tx,
  ids: string[],
): Promise<{ events: number; links: number }> {
  if (ids.length === 0) return { events: 0, links: 0 };

  const delLinks = await tx
    .delete(orgsEventsInTest)
    .where(inArray(orgsEventsInTest.eventId, ids))
    .returning({ eventId: orgsEventsInTest.eventId });

  const delEvents = await tx
    .delete(eventsInTest)
    .where(inArray(eventsInTest.id, ids))
    .returning({ id: eventsInTest.id });

  return { events: delEvents.length, links: delLinks.length };
}

async function writeBackup(
  path: string,
  tx: Tx,
  eventIds: string[],
): Promise<void> {
  // Embeddings are excluded: 1024 floats per row, regenerable by the scraper,
  // and they would dwarf everything worth reading in here.
  const payload = {
    note:
      "Rows removed by scripts/deleteEvent.ts. A reconstruction aid, not an" +
      " undo: re-inserting may collide with events_url_unique if the scraper" +
      " has recreated them. Embeddings omitted.",
    deletedAt: new Date().toISOString(),
    events:
      eventIds.length === 0
        ? []
        : await tx
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
    orgLinks:
      eventIds.length === 0
        ? []
        : await tx
            .select({
              eventId: orgsEventsInTest.eventId,
              orgId: orgsEventsInTest.orgId,
              orgName: orgsInTest.name,
            })
            .from(orgsEventsInTest)
            .innerJoin(orgsInTest, eq(orgsInTest.id, orgsEventsInTest.orgId))
            .where(inArray(orgsEventsInTest.eventId, eventIds)),
  };

  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\nBackup written to ${path}`);
}

function afterword(backup: string | null): string {
  return [
    "",
    "Before you consider this done:",
    "  1. n8n owns event ingestion and will re-insert anything still listed on",
    "     the source page, with a new UUID. Fix the scrape config too, or this",
    "     comes back on the next run.",
    "  2. /api/dataEvents caches for 60s in-process, so deleted events can",
    "     still appear on the calendar briefly.",
    backup === null
      ? "  3. There is no undo and you did not pass --backup."
      : `  3. Rows removed were written to ${backup} (reconstruction aid, not an undo).`,
  ].join("\n");
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
    await listEvents(cmd.filter);
    return 0;
  }
  if (cmd.kind === "duplicates") {
    return deleteDuplicates(cmd);
  }
  return deleteEvent(cmd);
}

try {
  process.exitCode = await main();
} catch (err) {
  const cause = (err as { cause?: { code?: string; constraint?: string } })
    ?.cause;
  if (cause?.code === "23503") {
    console.error(
      `\nForeign-key violation on ${cause.constraint ?? "an unknown constraint"}.` +
        " Something references this event that the script does not know about." +
        " Nothing was deleted.",
    );
  } else if (cause?.code === "55P03") {
    console.error(
      "\nTimed out waiting for a lock — something else is writing to these rows" +
        " right now (an n8n scrape, most likely). Nothing was deleted; try" +
        " again in a minute.",
    );
  } else if (cause?.code === "57014") {
    console.error(
      "\nStatement timed out after 60s. Nothing was deleted. If the table really" +
        " has that many duplicates, raise statement_timeout in the script.",
    );
  } else {
    console.error("\nFailed, nothing was deleted:", err);
  }
  process.exitCode = 1;
}

process.exit(process.exitCode ?? 0);
