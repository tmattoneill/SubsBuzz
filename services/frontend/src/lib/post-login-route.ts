import { api } from "@/lib/api-client";

/**
 * Decide where a freshly-authenticated user should land.
 *
 *   no monitored senders (first login or they removed them all) → /email-handling
 *   senders exist + a digest has been generated                 → /digest/:date
 *   senders exist but no digest yet                             → /dashboard
 *
 * Used by auth-callback.tsx (new OAuth) and login.tsx (already-authenticated
 * revisit). Failures on either API call fall through — we'd rather land the
 * user on /dashboard than bounce them to email-handling on a transient error.
 */
export async function resolvePostLoginRoute(): Promise<string> {
  try {
    const senders = await api.get<Array<unknown>>("/api/monitored-emails");
    if (!Array.isArray(senders) || senders.length === 0) {
      return "/email-handling";
    }
  } catch {
    // fall through to digest check
  }

  try {
    const latest = await api.get<{ data?: { date?: string } }>("/api/digest/latest");
    const date = latest?.data?.date;
    if (date) return `/digest/${date.split("T")[0]}`;
  } catch {
    // fall through
  }

  return "/dashboard";
}
