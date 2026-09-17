import { renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("~/db", () => ({
  liveQueryClient: {
    execute: (sql: string, params: unknown[] = []) =>
      Promise.resolve(transport.read(sql, params)),
  },
  executeTransaction: vi.fn(),
  useLiveQuery: (options: {
    sql: string;
    params?: unknown[];
    enabled?: boolean;
    mapRows?: (rows: Record<string, unknown>[]) => unknown;
  }) => {
    const rows =
      options.enabled === false
        ? []
        : transport.read(options.sql, options.params ?? []);
    return { data: options.mapRows ? options.mapRows(rows) : rows };
  },
}));
vi.mock("@anlg/plugin-transcription", () => ({ commands: {} }));
vi.mock("~/stt/speaker-context-query", () => ({
  useSpeakerContext: () => null,
}));

import fixture from "../../../../dialext/fixtures/language-practice.json";
import { prepareDialextImport } from "./recording-import";

import { useSessionTranscriptRenderData } from "~/session/components/note-input/transcript/render-request-hooks";
import { loadSessionContentSnapshot } from "~/session/content-queries";
import {
  getSessionTranscriptRecords,
  useSessionTranscripts,
  useSessionTranscriptMetadata,
} from "~/stt/queries";

const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");
let db: InstanceType<typeof DatabaseSync>;
const sessionId = `dialext-${fixture.recording.id}`;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  for (const migration of [
    "20260710223922_canonical_data_model",
    "20260714120000_search_index_queue",
    "20260815100000_transcript_content_revision",
    "20260815100100_transcript_live_deltas",
    "20260917120000_dialext_accounts",
    "20260917120100_dialext_effective_transcripts",
  ]) {
    db.exec(
      readFileSync(
        resolve(
          process.cwd(),
          `../../crates/db-app/migrations/${migration}.sql`,
        ),
        "utf8",
      ),
    );
  }
  db.prepare("INSERT INTO sessions(id,title) VALUES(?,?)").run(
    sessionId,
    fixture.recording.title,
  );
  for (const [language, code] of [
    ["english", "en"],
    ["irish", "ga"],
  ] as const) {
    const transcript = prepareDialextImport(JSON.stringify(fixture), language, {
      workspaceId: "local",
      ownerUserId: "test",
    }).envelope.transcripts[0];
    transcript.words[0].text =
      code === "en" ? "Saved English correction: tea." : "Ceartú Gaeilge: tae.";
    db.prepare(
      "INSERT INTO transcripts(id,session_id,language,words_json) VALUES(?,?,?,?)",
    ).run(code, sessionId, code, JSON.stringify(transcript.words));
    db.prepare(
      "INSERT INTO dialext_accounts(id,session_id,transcript_id,target_language,input_evidence_digest,original_sha256) VALUES(?,?,?,?,?,?)",
    ).run(code, sessionId, code, code, "0".repeat(64), "0".repeat(64));
  }
  db.prepare(
    "INSERT INTO dialext_recordings(id,active_account_id) VALUES(?,'en')",
  ).run(sessionId);
  db.prepare(
    "INSERT INTO session_documents(id,session_id,kind,body_format,body) VALUES('summary',?,'summary','markdown','Saved manual summary')",
  ).run(sessionId);
  transport.read.mockImplementation(
    (sql: string, params: (string | number | null)[]) =>
      db.prepare(sql).all(...params),
  );
});
afterEach(() => {
  db.close();
  vi.clearAllMocks();
});

describe("effective language account on actual SQLite projections", () => {
  it("gives panel, copy/export renderer and enhancer/chat snapshot the same corrected selected text", async () => {
    for (const [code, wanted, absent] of [
      ["en", "Saved English correction: tea.", "Ceartú Gaeilge: tae."],
      ["ga", "Ceartú Gaeilge: tae.", "Saved English correction: tea."],
    ] as const) {
      db.prepare(
        "UPDATE dialext_recordings SET active_account_id = ? WHERE id = ?",
      ).run(code, sessionId);
      const records = await getSessionTranscriptRecords(sessionId);
      expect(records).toHaveLength(1);
      expect(records[0].words[0].text).toBe(wanted);
      const panel = renderHook(() => useSessionTranscripts(sessionId));
      expect(panel.result.current).toEqual(records);
      panel.unmount();
      const metadata = renderHook(() =>
        useSessionTranscriptMetadata(sessionId),
      );
      expect(metadata.result.current.map((r) => r.id)).toEqual([code]);
      metadata.unmount();
      const renderer = renderHook(() =>
        useSessionTranscriptRenderData(sessionId),
      );
      expect(JSON.stringify(renderer.result.current.request)).toContain(wanted);
      expect(JSON.stringify(renderer.result.current.request)).not.toContain(
        absent,
      );
      renderer.unmount();
      const snapshot = await loadSessionContentSnapshot(sessionId);
      expect(snapshot?.transcripts).toHaveLength(1);
      expect(snapshot?.transcripts[0].words[0].text).toBe(wanted);
      expect(snapshot?.enhancedNotes[0].markdown).toBe("Saved manual summary");
    }
  });
  it("shows no merged fallback when selection is absent or deleted, and preserves accounts on restore", async () => {
    db.prepare(
      "UPDATE dialext_recordings SET active_account_id = NULL WHERE id = ?",
    ).run(sessionId);
    expect(await getSessionTranscriptRecords(sessionId)).toEqual([]);
    db.prepare(
      "UPDATE dialext_recordings SET active_account_id = 'ga' WHERE id = ?",
    ).run(sessionId);
    db.prepare("UPDATE sessions SET deleted_at = 'deleted' WHERE id = ?").run(
      sessionId,
    );
    expect(await getSessionTranscriptRecords(sessionId)).toEqual([]);
    db.prepare("UPDATE sessions SET deleted_at = NULL WHERE id = ?").run(
      sessionId,
    );
    expect(
      (await getSessionTranscriptRecords(sessionId))[0].words[0].text,
    ).toBe("Ceartú Gaeilge: tae.");
  });
});
