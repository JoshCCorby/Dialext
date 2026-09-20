import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { readDialextSourceInterval } from "@anlg/plugin-db";
import { cn } from "@anlg/utils";

export type DialextAnchor = {
  source_id: string;
  start_ms: number;
  end_ms: number;
};

export type DialextPassage = {
  wordId: string;
  text: string;
  anchors: DialextAnchor[];
  spokenLanguage: string;
  targetLanguage: string;
};

type Reveal = {
  sessionId: string;
  passage: DialextPassage;
  requestedAt: number;
};

const DialextSourceContext = createContext<{
  reveal: (passage: DialextPassage) => void;
  close: () => void;
  revealed: string | null;
  current: Reveal | null;
} | null>(null);

export function useDialextSource() {
  return useContext(DialextSourceContext);
}

/// One panel for the whole recording workspace. A transcript mark, and later a summary
/// source control or a chat citation, all resolve to the same reveal rather than each
/// growing a playback surface of its own.
export function DialextSourceProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const [reveal, setReveal] = useState<Reveal | null>(null);
  useEffect(() => setReveal(null), [sessionId]);

  const value = useMemo(
    () => ({
      reveal: (passage: DialextPassage) =>
        setReveal({ sessionId, passage, requestedAt: Date.now() }),
      close: () => setReveal(null),
      revealed: reveal?.passage.wordId ?? null,
      current: reveal && reveal.sessionId === sessionId ? reveal : null,
    }),
    [reveal, sessionId],
  );

  return (
    <DialextSourceContext.Provider value={value}>
      {children}
    </DialextSourceContext.Provider>
  );
}

/// Rendered where the panel belongs in the workspace, so the reveal appears inside
/// the recording rather than floating over whatever opened it.
export function DialextSourcePanelSlot() {
  const source = useDialextSource();
  if (!source?.current) return null;
  return <SourcePanel reveal={source.current} onClose={source.close} />;
}

function SourcePanel({
  reveal,
  onClose,
}: {
  reveal: Reveal;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [reveal.requestedAt]);

  return (
    <section
      aria-label={t`Source for this passage`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      className="bg-background flex max-h-80 shrink-0 flex-col gap-2 overflow-y-auto border-t px-6 py-3 text-sm"
    >
      <div className="flex items-start gap-3">
        <h2
          ref={heading}
          tabIndex={-1}
          className="flex-1 font-medium outline-hidden"
        >
          <Trans>Source for this passage</Trans>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-md border px-2 py-0.5 text-xs"
        >
          <Trans>Close</Trans>
        </button>
      </div>
      <p className="text-muted-foreground">{describeOrigin(reveal.passage)}</p>
      <blockquote className="border-l-2 pl-3">{reveal.passage.text}</blockquote>
      {reveal.passage.anchors.length === 0 ? (
        <p role="status">
          <Trans>This passage names no source interval.</Trans>
        </p>
      ) : (
        reveal.passage.anchors.map((anchor) => (
          <SourceAnchor
            key={`${anchor.source_id}:${anchor.start_ms}:${anchor.end_ms}`}
            sessionId={reveal.sessionId}
            anchor={anchor}
          />
        ))
      )}
    </section>
  );
}

function SourceAnchor({
  sessionId,
  anchor,
}: {
  sessionId: string;
  anchor: DialextAnchor;
}) {
  const query = useQuery({
    queryKey: [
      "dialext-source-interval",
      sessionId,
      anchor.source_id,
      anchor.start_ms,
      anchor.end_ms,
    ],
    queryFn: () =>
      readDialextSourceInterval(
        sessionId,
        anchor.source_id,
        anchor.start_ms,
        anchor.end_ms,
      ),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <p className="text-muted-foreground text-xs">
        {describeSource(anchor.source_id)} ·{" "}
        {formatInterval(anchor.start_ms, anchor.end_ms)}
      </p>
      {query.isPending && (
        <p role="status">
          <Trans>Checking this source…</Trans>
        </p>
      )}
      {query.error && (
        <p role="alert" className="text-destructive">
          {query.error instanceof Error
            ? query.error.message
            : String(query.error)}
        </p>
      )}
      {query.data && (
        <>
          <p>{query.data.evidenceText}</p>
          <p className="text-muted-foreground text-xs">
            {query.data.providerLabel ? (
              <Trans>
                This reading heard {query.data.providerLabel}. Each reading
                labels voices on its own.
              </Trans>
            ) : (
              <Trans>This reading did not attribute a voice.</Trans>
            )}
          </p>
          <SourceClip
            clip={query.data.audio}
            unavailable={query.data.audioUnavailable}
            start={anchor.start_ms}
            end={anchor.end_ms}
          />
        </>
      )}
    </div>
  );
}

function SourceClip({
  clip,
  unavailable,
  start,
  end,
}: {
  clip: { measuredDurationMs: number; clipWav: number[] } | null;
  unavailable: string | null;
  start: number;
  end: number;
}) {
  const { t } = useLingui();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!clip) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(
      new Blob([new Uint8Array(clip.clipWav)], { type: "audio/wav" }),
    );
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [clip]);

  if (!clip) {
    return (
      <p role="status" className="text-muted-foreground text-xs">
        {describeMissingAudio(unavailable)}
      </p>
    );
  }

  return (
    <>
      {/* The clip is the stored samples for this interval, so playing it cannot drift
          past the passage the way seeking a whole recording can. */}
      <audio
        controls
        src={url ?? undefined}
        aria-label={t`Play the recorded audio for this passage`}
        className="w-full"
      />
      <p className="text-muted-foreground text-xs">
        <Trans>
          Exactly the recorded audio from {formatInterval(start, end)}. The
          words above are what this reading heard; the passage timing is not a
          measured word timing.
        </Trans>
      </p>
    </>
  );
}

export function describeOrigin(passage: DialextPassage): string {
  const spoken = describeLanguage(passage.spokenLanguage);
  if (!spoken) {
    return "The original language of this passage was not established.";
  }
  return sameLanguage(passage.spokenLanguage, passage.targetLanguage)
    ? `Spoken in ${spoken} and written in ${spoken}.`
    : `Spoken in ${spoken} and written here in ${describeLanguage(passage.targetLanguage) ?? "another language"}.`;
}

export function describeLanguage(value: string): string | null {
  if (value === "english" || value === "en") return "English";
  if (value === "irish" || value === "ga") return "Irish";
  return null;
}

function sameLanguage(spoken: string, target: string) {
  return describeLanguage(spoken) === describeLanguage(target);
}

export function describeSource(sourceId: string): string {
  if (sourceId === "irish-asr") return "Irish reading";
  if (sourceId === "english-asr") return "English reading";
  return sourceId;
}

export function describeMissingAudio(reason: string | null): string {
  switch (reason) {
    case "no_source_audio":
      return "This recording has no source audio stored.";
    case "audio_missing_or_corrupt":
      return "The stored source audio is missing or does not match its recorded digest.";
    case "interval_beyond_measured_audio":
      return "This passage names an interval past the end of the measured audio.";
    default:
      return "The source audio for this passage is unavailable.";
  }
}

export function formatInterval(startMs: number, endMs: number): string {
  return `${formatTimestamp(startMs)}–${formatTimestamp(endMs)}`;
}

function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/// The quiet per-passage control. It is absent, not disabled, where a passage names
/// no source: a control that opens nothing is worse than none.
export function DialextPassageSource({
  word,
}: {
  word: { id?: string | null; text?: string; metadata?: unknown };
}) {
  const source = useDialextSource();
  const passage = readPassage(word);
  const open = useCallback(() => {
    if (passage) source?.reveal(passage);
  }, [passage, source]);
  if (!source || !passage) return null;

  const revealed = source.revealed === passage.wordId;
  return (
    <button
      type="button"
      data-dialext-source-control
      aria-pressed={revealed}
      onClick={open}
      className={cn([
        "text-muted-foreground hover:text-foreground ml-1 rounded-sm align-baseline text-[11px]",
        "underline decoration-dotted underline-offset-2",
        revealed ? "text-foreground" : null,
      ])}
    >
      {shortOrigin(passage)}
    </button>
  );
}

export function shortOrigin(passage: DialextPassage): string {
  const spoken = describeLanguage(passage.spokenLanguage);
  if (!spoken) return "language unknown";
  return sameLanguage(passage.spokenLanguage, passage.targetLanguage)
    ? `as spoken · ${spoken}`
    : `translated · ${spoken}`;
}

export function readPassage(word: {
  id?: string | null;
  text?: string;
  metadata?: unknown;
}): DialextPassage | null {
  const metadata = word.metadata;
  if (!isRecord(metadata) || typeof word.id !== "string" || !word.id) {
    return null;
  }
  const dialext = metadata.dialext;
  if (!isRecord(dialext) || !Array.isArray(dialext.anchors)) return null;
  const anchors = dialext.anchors.filter(
    (anchor): anchor is DialextAnchor =>
      isRecord(anchor) &&
      typeof anchor.source_id === "string" &&
      typeof anchor.start_ms === "number" &&
      typeof anchor.end_ms === "number",
  );
  if (anchors.length === 0) return null;
  return {
    wordId: word.id,
    text: typeof word.text === "string" ? word.text : "",
    anchors,
    spokenLanguage:
      typeof dialext.spoken_language === "string"
        ? dialext.spoken_language
        : "unknown",
    targetLanguage:
      typeof dialext.target_language === "string"
        ? dialext.target_language
        : "unknown",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
