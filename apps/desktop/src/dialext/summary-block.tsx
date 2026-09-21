import type { NodeViewComponentProps } from "@handlewithcare/react-prosemirror";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import {
  createContext,
  forwardRef,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

import { cn } from "@anlg/utils";

import {
  type DialextAnchor,
  type DialextPassage,
  shortOrigin,
  useDialextSource,
} from "./source-panel";

import { useLiveQuery } from "~/db";

type EvidenceRow = {
  block_id: string;
  passage_word_id: string;
  block_text: string;
  anchors_json: string;
  spoken_language: string;
  target_language: string;
};

export type DialextBlockEvidence = {
  passage: DialextPassage;
  pinnedText: string;
};

const DialextOutputContext = createContext<Map<
  string,
  DialextBlockEvidence
> | null>(null);

/// The stored evidence of one output's blocks, live: accepting a correction proposal
/// re-pins a block natively, and the control follows without a reload.
export function DialextOutputEvidence({
  documentId,
  children,
}: {
  documentId: string;
  children: ReactNode;
}) {
  const { data } = useLiveQuery<EvidenceRow, EvidenceRow[]>({
    sql: `
      SELECT block_id, passage_word_id, block_text, anchors_json,
        spoken_language, target_language
      FROM dialext_block_evidence
      WHERE document_id = ?
    `,
    params: [documentId],
    enabled: Boolean(documentId),
  });
  const evidence = useMemo(() => toEvidence(data ?? []), [data]);
  return (
    <DialextOutputContext.Provider value={evidence}>
      {children}
    </DialextOutputContext.Provider>
  );
}

export function toEvidence(rows: EvidenceRow[]) {
  const evidence = new Map<string, DialextBlockEvidence>();
  for (const row of rows) {
    const anchors = parseAnchors(row.anchors_json);
    if (anchors.length === 0) continue;
    evidence.set(row.block_id, {
      pinnedText: row.block_text,
      passage: {
        wordId: row.passage_word_id,
        text: row.block_text,
        anchors,
        spokenLanguage: row.spoken_language,
        targetLanguage: row.target_language,
      },
    });
  }
  return evidence;
}

/// The block's text as the native owner reads it: each child's inline text, children
/// separated by a blank line. Comparing anything looser would call an edited block
/// verified.
export function blockText(node: ProseMirrorNode): string {
  const parts: string[] = [];
  node.forEach((child) => parts.push(child.textContent));
  return parts.join("\n\n");
}

export const DialextBlockView = forwardRef<
  HTMLDivElement,
  NodeViewComponentProps & { children?: ReactNode }
>(function DialextBlockView({ nodeProps, children, ...htmlAttrs }, ref) {
  const { node } = nodeProps;
  const id = typeof node.attrs.id === "string" ? node.attrs.id : "";
  const evidence = useContext(DialextOutputContext)?.get(id) ?? null;

  return (
    <div
      ref={ref}
      {...htmlAttrs}
      data-dialext-block={id}
      className="group/dialext-block relative"
    >
      <div ref={nodeProps.contentDOMRef}>{children}</div>
      {evidence && (
        <BlockSourceControl
          evidence={evidence}
          edited={blockText(node) !== evidence.pinnedText}
        />
      )}
    </div>
  );
});

/// The one quiet source control on a summary block. It is absent where the block has
/// no stored evidence: a block generated before evidence was stored, or one the
/// reader added, has nothing to show and never borrows a neighbour's source.
function BlockSourceControl({
  evidence,
  edited,
}: {
  evidence: DialextBlockEvidence;
  edited: boolean;
}) {
  const source = useDialextSource();
  if (!source) return null;
  const revealed = source.revealed === evidence.passage.wordId;
  return (
    <span contentEditable={false} className="block select-none">
      <button
        type="button"
        data-dialext-block-source
        aria-pressed={revealed}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() =>
          source.reveal(evidence.passage, { kind: "summary", edited })
        }
        className={cn([
          "text-muted-foreground hover:text-foreground rounded-sm text-[11px]",
          "underline decoration-dotted underline-offset-2",
          "opacity-0 transition-opacity focus-visible:opacity-100",
          "group-focus-within/dialext-block:opacity-100 group-hover/dialext-block:opacity-100",
          revealed ? "text-foreground opacity-100" : null,
        ])}
      >
        {edited
          ? "edited · source"
          : `source · ${shortOrigin(evidence.passage)}`}
      </button>
    </span>
  );
}

function parseAnchors(value: string): DialextAnchor[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (anchor): anchor is DialextAnchor =>
        Boolean(anchor) &&
        typeof anchor === "object" &&
        typeof anchor.source_id === "string" &&
        typeof anchor.start_ms === "number" &&
        typeof anchor.end_ms === "number",
    );
  } catch {
    return [];
  }
}
