import type { LanguageModel } from "ai";

import { answerDialextQuestion } from "./question-answer";
import {
  loadDialextQuestionEvidence,
  selectQuestionEvidence,
} from "./question-evidence";
import type { DialextPassage } from "./source-panel";
import { isDialextRecording } from "./summary";

export const DIALEXT_ANSWER_PART = "data-dialext-answer";

/// Stored with the chat message, so a citation reopens the same source panel months
/// later. The passage carries its own anchors; the native interval read re-checks
/// them against the recording's evidence every time it is opened.
export type DialextAnswerData = {
  sessionId: string;
  outcome: "answer" | "insufficient" | "no-match" | "unavailable" | "invalid";
  code?: string;
  accountId?: string;
  contentVersion?: string;
  targetLanguage?: string;
  citations: Array<{
    quote: string;
    speaker: string | null;
    passage: DialextPassage;
  }>;
};

export type DialextAnswerReply = { text: string; data: DialextAnswerData };

const REFUSALS = {
  en: {
    unanswered: "The recording does not answer that.",
    unavailable: "This recording has no reading available to answer from.",
    invalid:
      "No answer could be given that the recording supports, so none is shown.",
  },
  ga: {
    unanswered: "Níl freagra air sin sa taifeadadh.",
    unavailable: "Níl aon léamh ar fáil don taifeadadh seo le freagra a fháil.",
    invalid:
      "Níorbh fhéidir freagra a thabhairt a bhfuil tacaíocht an taifeadta leis, mar sin níl aon cheann á thaispeáint.",
  },
} as const;

function refusals(targetLanguage?: string) {
  return targetLanguage === "ga" || targetLanguage === "irish"
    ? REFUSALS.ga
    : REFUSALS.en;
}

/// Answers a question about one Dialext recording from its selected, corrected
/// reading, or returns null when the session is not a Dialext recording so the
/// ordinary chat path keeps it. Every refusal is decided here, not by the model:
/// a recording with no usable reading, a specific question no passage mentions, a
/// model that says it cannot answer, and an answer whose citations do not check out.
export async function answerRecordingQuestion({
  sessionId,
  question,
  model,
  selfHumanId,
  abortSignal,
}: {
  sessionId: string;
  question: string;
  model: LanguageModel;
  selfHumanId?: string;
  abortSignal?: AbortSignal;
}): Promise<DialextAnswerReply | null> {
  if (!(await isDialextRecording(sessionId))) return null;

  const evidence = await loadDialextQuestionEvidence(sessionId, selfHumanId);
  if (evidence.kind === "unavailable") {
    return {
      text: refusals().unavailable,
      data: { sessionId, outcome: "unavailable", citations: [] },
    };
  }
  const pinned = {
    sessionId,
    accountId: evidence.accountId,
    contentVersion: evidence.contentVersion,
    targetLanguage: evidence.targetLanguage,
  };
  const words = refusals(evidence.targetLanguage);

  const selected = selectQuestionEvidence(question, evidence.passages);
  if (selected.kind === "no-match") {
    return {
      text: words.unanswered,
      data: { ...pinned, outcome: "no-match", citations: [] },
    };
  }

  const answer = await answerDialextQuestion({
    model,
    question,
    passages: selected.passages,
    targetLanguage: evidence.targetLanguage,
    abortSignal,
  });
  if (answer.kind === "insufficient") {
    return {
      text: words.unanswered,
      data: { ...pinned, outcome: "insufficient", citations: [] },
    };
  }
  if (answer.kind === "invalid") {
    return {
      text: words.invalid,
      data: { ...pinned, outcome: "invalid", code: answer.code, citations: [] },
    };
  }
  return {
    text: answer.text,
    data: {
      ...pinned,
      outcome: "answer",
      citations: answer.citations.map(({ passage, quote }) => ({
        quote,
        speaker: passage.speaker,
        passage: {
          wordId: passage.wordId,
          text: passage.text,
          anchors: passage.anchors,
          spokenLanguage: passage.spokenLanguage,
          targetLanguage: passage.targetLanguage,
        },
      })),
    },
  };
}
