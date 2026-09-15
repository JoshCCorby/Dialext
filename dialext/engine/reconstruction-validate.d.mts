export type Anchor = {
  source_id: "irish-asr" | "english-asr";
  start_ms: number;
  end_ms: number;
};
export function validateReconstruction(input: {
  segments: Array<{
    start_ms: number;
    end_ms: number;
    speaker: string | null;
    text: string;
    anchors: Anchor[];
  }>;
  language: "irish" | "english";
  transcriptPayload: {
    sources: Array<{
      source_id: "irish-asr" | "english-asr";
      segments: Array<{
        start_ms: number;
        end_ms: number;
        speaker: string | null;
        text: string;
      }>;
    }>;
  };
  durationMs?: number;
}): Array<{
  start_ms: number;
  end_ms: number;
  speaker: string | null;
  text: string;
  language: "irish" | "english";
  anchors: Anchor[];
}>;
