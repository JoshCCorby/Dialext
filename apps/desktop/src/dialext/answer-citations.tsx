import { Trans } from "@lingui/react/macro";

import type { DialextAnswerData, DialextAnswerPin } from "./question-chat";
import {
  describeLanguage,
  type DialextPassage,
  isDialextAnchor,
  isRecord,
  revealDialextSource,
  shortOrigin,
} from "./source-panel";

import { useTabs } from "~/store/zustand/tabs";

/// What stands behind an answer about a Dialext recording. The answer above it is
/// the model's own wording; the quotations here are the reading's, and each opens
/// the recording's one source panel. Refusals say which check refused.
export function DialextAnswerCitations({ data }: { data: unknown }) {
  const answer = readAnswerData(data);
  const openNew = useTabs((state) => state.openNew);
  if (!answer) return null;

  const reading =
    answer.outcome === "unavailable"
      ? null
      : describeLanguage(answer.targetLanguage);
  const open = (passage: DialextPassage, quote: string) => {
    const current = useTabs.getState().currentTab;
    if (current?.type !== "sessions" || current.id !== answer.sessionId) {
      openNew({ type: "sessions", id: answer.sessionId });
    }
    revealDialextSource(answer.sessionId, passage, { kind: "answer", quote });
  };

  if (answer.outcome !== "answer") {
    return (
      <p className="text-muted-foreground mt-1 text-xs">
        {answer.outcome === "no-match" && (
          <Trans>
            Nothing in the selected reading mentions this, so no model was
            asked.
          </Trans>
        )}
        {answer.outcome === "insufficient" && (
          <Trans>The model found no passage that answers this.</Trans>
        )}
        {answer.outcome === "invalid" && (
          <Trans>
            The model's answer did not check out against the reading, so it is
            not shown.
          </Trans>
        )}
        {answer.outcome === "unavailable" && (
          <Trans>
            Select an available reading to ask about this recording.
          </Trans>
        )}
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-2 text-xs">
      <p className="text-muted-foreground">
        {reading ? (
          <Trans>
            Answer written by the model from these passages of the {reading}{" "}
            reading:
          </Trans>
        ) : (
          <Trans>Answer written by the model from these passages:</Trans>
        )}
      </p>
      {answer.citations.map((citation) => (
        <div key={citation.passage.wordId} className="flex flex-col gap-0.5">
          <p>
            {citation.speaker && (
              <span className="font-medium">{citation.speaker}: </span>
            )}
            <q>{citation.quote}</q>
          </p>
          <button
            type="button"
            data-dialext-answer-source
            onClick={() => open(citation.passage, citation.quote)}
            className="text-muted-foreground hover:text-foreground self-start rounded-sm text-[11px] underline decoration-dotted underline-offset-2"
          >
            source · {shortOrigin(citation.passage)}
          </button>
        </div>
      ))}
    </div>
  );
}

const OUTCOMES = [
  "answer",
  "insufficient",
  "no-match",
  "unavailable",
  "invalid",
] as const satisfies readonly DialextAnswerData["outcome"][];

/// The part is read back from stored chat history, so it is checked field by field
/// rather than trusted as the shape it was written with.
function readAnswerData(value: unknown): DialextAnswerData | null {
  if (!isRecord(value) || typeof value.sessionId !== "string") return null;
  const outcome = OUTCOMES.find((candidate) => candidate === value.outcome);
  if (!outcome) return null;
  const base = {
    sessionId: value.sessionId,
    citations: Array.isArray(value.citations)
      ? value.citations.flatMap(readCitation)
      : [],
  };
  if (outcome === "unavailable") return { ...base, outcome };
  const pin = readPin(value);
  if (!pin) return null;
  if (outcome !== "invalid") return { ...base, ...pin, outcome };
  return typeof value.code === "string"
    ? { ...base, ...pin, outcome, code: value.code }
    : null;
}

function readPin(value: Record<string, unknown>): DialextAnswerPin | null {
  const { accountId, contentVersion, targetLanguage } = value;
  return typeof accountId === "string" &&
    typeof contentVersion === "string" &&
    typeof targetLanguage === "string"
    ? { accountId, contentVersion, targetLanguage }
    : null;
}

function readCitation(value: unknown): DialextAnswerData["citations"] {
  if (!isRecord(value) || typeof value.quote !== "string") return [];
  const passage = value.passage;
  if (
    !isRecord(passage) ||
    typeof passage.wordId !== "string" ||
    !Array.isArray(passage.anchors)
  ) {
    return [];
  }
  return [
    {
      quote: value.quote,
      speaker: typeof value.speaker === "string" ? value.speaker : null,
      passage: {
        wordId: passage.wordId,
        text: typeof passage.text === "string" ? passage.text : "",
        anchors: passage.anchors.filter(isDialextAnchor),
        spokenLanguage:
          typeof passage.spokenLanguage === "string" ? passage.spokenLanguage : "unknown",
        targetLanguage:
          typeof passage.targetLanguage === "string" ? passage.targetLanguage : "unknown",
      },
    },
  ];
}
