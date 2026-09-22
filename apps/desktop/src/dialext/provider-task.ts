import { useLiveQuery } from "~/db";

export type DialextProviderTask = {
  id: string;
  session_id: string;
  target_language: "en" | "ga";
  status:
    | "queued"
    | "running"
    | "cancel_requested"
    | "cancelled"
    | "failed"
    | "interrupted"
    | "succeeded";
  current_stage:
    | "queued"
    | "asr_ga"
    | "asr_en"
    | "reconstruct"
    | "store"
    | "done";
  error: string;
};

export function useDialextProviderTask(taskId: string | null) {
  const query = useLiveQuery<DialextProviderTask, DialextProviderTask[]>({
    sql: `SELECT id,session_id,target_language,status,current_stage,error
      FROM dialext_provider_tasks WHERE id=?`,
    params: [taskId ?? ""],
    enabled: Boolean(taskId),
  });
  return query.data?.[0] ?? null;
}

export function useLatestDialextProviderTask(sessionId: string) {
  const query = useLiveQuery<DialextProviderTask, DialextProviderTask[]>({
    sql: `SELECT id,session_id,target_language,status,current_stage,error
      FROM dialext_provider_tasks WHERE session_id=?
      ORDER BY created_at DESC LIMIT 1`,
    params: [sessionId],
    enabled: Boolean(sessionId),
  });
  return query.data?.[0] ?? null;
}

export function providerTaskLabel(task: DialextProviderTask) {
  if (task.status === "succeeded") return "Reading ready.";
  if (task.status === "cancelled") return "Generation cancelled.";
  if (task.status === "interrupted") {
    return "Generation stopped when the app closed. Successful stages were kept.";
  }
  if (task.status === "failed") return task.error || "Generation failed.";
  if (task.status === "cancel_requested") return "Cancelling…";
  return {
    queued: "Waiting to start…",
    asr_ga: "Reading the Irish speech source…",
    asr_en: "Reading the English speech source…",
    reconstruct: "Building the requested reading…",
    store: "Saving the checked reading…",
    done: "Reading ready.",
  }[task.current_stage];
}
