import { jobService } from "@/services/jobService";
import { classifyPoll } from "@/services/generationPolling";

/**
 * Awaitable observer for flows that need the result inside one async function
 * (e.g. building a PDF from generated images). Network errors never fail the wait:
 * it keeps polling, and wakes up immediately when the app becomes visible / online again.
 */
export async function waitForJob(jobId, { intervalMs = 2500, maxMs = 12 * 60 * 1000, signal = null } = {}) {
  const startedAt = Date.now();
  let wake = null;
  const onWake = () => { if (wake) wake(); };
  const hasDoc = typeof document !== "undefined";
  if (hasDoc) document.addEventListener("visibilitychange", onWake);
  if (typeof window !== "undefined") window.addEventListener("online", onWake);
  try {
    for (;;) {
      if (signal?.aborted) throw new Error("ABORTED");
      const outcome = classifyPoll(await jobService.pollGenerationDetailed(jobId));
      if (outcome.kind === "done") return outcome.data;
      if (outcome.kind === "failed") throw new Error(outcome.error || "GENERATION_FAILED");
      if (Date.now() - startedAt > maxMs) throw new Error("GENERATION_WAIT_TIMEOUT");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, intervalMs);
        wake = () => { clearTimeout(timer); resolve(); };
      });
      wake = null;
    }
  } finally {
    if (hasDoc) document.removeEventListener("visibilitychange", onWake);
    if (typeof window !== "undefined") window.removeEventListener("online", onWake);
  }
}

/** Runs one generate request and resolves with the final result, whether the server answers
 *  synchronously (old deploy) or with `processing` + job_id (background generation). */
export async function generateAndWait(runEyadEngine, params, options) {
  const first = await runEyadEngine({ ...params, action: "generate" });
  if (first?.status === "generated" || first?.status === "completed") return first;
  if (first?.job_id) return waitForJob(first.job_id, options);
  return first;
}
