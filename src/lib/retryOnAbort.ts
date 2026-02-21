/**
 * Run an async operation and retry once on AbortError / "Signal is aborted".
 * Fixes spurious aborts (e.g. React Strict Mode, browser) so save/add flows complete.
 */
const ABORT_DELAY_MS = 200;

function isAbortError(e: unknown): boolean {
  if (e instanceof Error) {
    if (e.name === "AbortError") return true;
    if (/signal is aborted|aborted without reason/i.test(e.message)) return true;
  }
  return false;
}

export async function retryOnAbort<T>(
  fn: () => Promise<T>,
  options?: { delayMs?: number; maxRetries?: number }
): Promise<T> {
  const delayMs = options?.delayMs ?? ABORT_DELAY_MS;
  const maxRetries = options?.maxRetries ?? 1;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries && isAbortError(e)) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}
