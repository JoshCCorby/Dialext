import {
  generateText,
  type LanguageModel,
  NoObjectGeneratedError,
  Output,
} from "ai";
import { z } from "zod";

import { answerIsInOtherLanguage } from "./answer-language";
import type { EvidencePassage } from "./question-evidence";
import { describeLanguage } from "./source-panel";

/// What a question about a Dialext recording produced. Only `answer` carries model
/// prose, and only after every citation in it resolved to a supplied passage and a
/// contiguous quotation from that passage.
export type GroundedAnswer =
  | { kind: "answer"; text: string; citations: GroundedCitation[] }
  | { kind: "insufficient" }
  | { kind: "invalid"; code: string };

export type GroundedCitation = { passage: EvidencePassage; quote: string };

const answerSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({ passage: z.string(), quote: z.string().optional() }),
  ),
  insufficient_evidence: z.boolean(),
});

export type AnswerCandidate = z.infer<typeof answerSchema>;

function normalise(text: string) {
  return text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

/// The same rules as the original Dialext answer validator, applied to passages of
/// the selected reading rather than raw provider segments: an answer must cite, a
/// refusal must not, each citation names a supplied passage, and each quotation is
/// contiguous text of that passage. Anything else is never shown as an answer.
export function validateGroundedAnswer(
  candidate: unknown,
  passages: EvidencePassage[],
): GroundedAnswer {
  const parsed = answerSchema.safeParse(candidate);
  if (!parsed.success) return { kind: "invalid", code: "schema_validation" };
  const { answer, citations, insufficient_evidence } = parsed.data;

  if (insufficient_evidence) {
    return citations.length === 0
      ? { kind: "insufficient" }
      : { kind: "invalid", code: "contradictory_evidence_claim" };
  }
  if (citations.length === 0)
    return { kind: "invalid", code: "uncited_answer" };
  // Markers such as [P1] belong in citations, not in the prose the reader reads.
  const text = answer
    .replace(/\s*[[(]\s*P\d+(?:\s*[,;]\s*P\d+)*\s*[\])]/g, "")
    .trim();
  if (!text) return { kind: "invalid", code: "empty_answer" };

  const resolved: GroundedCitation[] = [];
  for (const citation of citations) {
    const source = citation.passage.trim();
    const passage = passages.find((candidate) =>
      [candidate.ref, labelledPassage(candidate)].includes(source),
    );
    if (!passage) return { kind: "invalid", code: "unknown_passage" };
    const quote =
      citation.quote?.trim() ||
      (source === labelledPassage(passage) ? passage.text : "");
    if (!quote || !normalise(passage.text).includes(normalise(quote))) {
      return { kind: "invalid", code: "quote_mismatch" };
    }
    if (!resolved.some((entry) => entry.passage.ref === passage.ref)) {
      resolved.push({ passage, quote });
    }
  }
  return { kind: "answer", text, citations: resolved };
}

function labelledPassage(passage: EvidencePassage) {
  return `${passage.ref} (${passage.speaker ?? "Unattributed"}): ${passage.text}`;
}

export function buildQuestionPrompt(
  question: string,
  passages: EvidencePassage[],
  targetLanguage: string,
) {
  const language = describeLanguage(targetLanguage) ?? "the reader's language";
  const system = [
    "You answer questions about one recording, using only the numbered passages supplied.",
    "The passages are the reader's corrected account of what was said. Nothing else about the recording is known.",
    `Write the answer in ${language}.`,
    "Cite every passage your answer relies on, with a short quotation copied exactly from that passage.",
    "Include only passages directly needed for the answer. Every citation needs a passage reference and quote.",
    "If the passages do not answer the question, set insufficient_evidence to true, leave citations empty, and say briefly that the recording does not answer it.",
    "Do not use outside knowledge and do not guess.",
  ].join("\n");
  const lines = passages.map(
    (passage) =>
      `${passage.ref} (${passage.speaker ?? "Unattributed"}): ${passage.text}`,
  );
  const prompt = `Passages:\n${lines.join("\n")}\n\nQuestion: ${question}\n\nAnswer in ${language}.`;
  return { system, prompt, language };
}

export async function answerDialextQuestion({
  model,
  question,
  passages,
  targetLanguage,
  abortSignal,
}: {
  model: LanguageModel;
  question: string;
  passages: EvidencePassage[];
  targetLanguage: string;
  abortSignal?: AbortSignal;
}): Promise<GroundedAnswer> {
  const { system, prompt, language } = buildQuestionPrompt(
    question,
    passages,
    targetLanguage,
  );
  const ask = async (correction?: string): Promise<GroundedAnswer> => {
    let candidate: unknown;
    try {
      const result = await generateText({
        model,
        system: correction ? `${system}\n${correction}` : system,
        prompt,
        output: Output.object({ schema: answerSchema }),
        temperature: 0,
        maxOutputTokens: 800,
        abortSignal,
      });
      candidate = result.output;
    } catch (error) {
      // A reply that was not the answer object is refused like any other invalid
      // answer. A model that could not run at all is a real error, reported as one.
      if (NoObjectGeneratedError.isInstance(error)) {
        return { kind: "invalid", code: "unparseable_answer" };
      }
      throw error;
    }
    return validateGroundedAnswer(candidate, passages);
  };

  // The reader may read only the reading's language, so an answer in another one is
  // not an answer for them. Ask once more, then refuse rather than show it.
  const first = await ask();
  if (
    first.kind !== "answer" ||
    !answerIsInOtherLanguage(first.text, targetLanguage)
  ) {
    return first;
  }
  const second = await ask(
    `Your previous answer was not written in ${language}. Write the answer text in ${language} only.`,
  );
  return second.kind === "answer" &&
    answerIsInOtherLanguage(second.text, targetLanguage)
    ? { kind: "invalid", code: "wrong_language" }
    : second;
}
