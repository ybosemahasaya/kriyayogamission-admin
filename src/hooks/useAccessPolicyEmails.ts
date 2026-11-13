import { useCallback, useEffect, useState } from "react";
import { AccessPolicyApiError, listAccessPolicyEmails } from "../api/access-policy";

interface UseAccessPolicyEmailsResult {
  emails: string[] | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  /** Lets the modal update local state straight from a POST/DELETE
   * response instead of issuing a redundant GET right after -- the
   * worker already returns the fresh list on every mutation. */
  setEmails: (emails: string[]) => void;
  reload: () => void;
}

/** Same loading/error/503 convention as the other Edge Analytics hooks
 * (useDnsRecords, useSslStatus) -- loads once when the modal mounts, no
 * polling (this list only changes when someone deliberately edits it
 * from this exact modal or the Cloudflare dashboard). */
export function useAccessPolicyEmails(): UseAccessPolicyEmailsResult {
  const [emails, setEmails] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    listAccessPolicyEmails()
      .then((result) => setEmails(result.emails))
      .catch((err) => {
        if (err instanceof AccessPolicyApiError && err.status === 503) {
          setNotConfigured(true);
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load the allowed email list.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { emails, loading, error, notConfigured, setEmails, reload: load };
}
