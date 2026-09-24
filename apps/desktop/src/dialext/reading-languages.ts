export type ReadingCode = "en" | "ga";

export const READING_CODES = ["en", "ga"] as const satisfies readonly ReadingCode[];

/// Shown in each language's own name, as the reader chooses it.
export const READING_NAMES: Record<ReadingCode, string> = {
  en: "English",
  ga: "Gaeilge",
};
