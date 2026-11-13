import type { AccessPolicyEmailsDTO } from "../../shared/access-policy";

const BASE = "/api/access-policy/emails";

/** A plain Error wouldn't carry the HTTP status code through to
 * callers -- useAccessPolicyEmails needs to tell "not configured yet"
 * (503) apart from a real failure, the same distinction every other
 * cf-ops hook (useDnsRecords, useSslStatus) already makes. */
export class AccessPolicyApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseOrThrow(res: Response): Promise<AccessPolicyEmailsDTO> {
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({ error: res.statusText }));
  throw new AccessPolicyApiError(body.error ?? `Request failed with ${res.status}`, res.status);
}

export function listAccessPolicyEmails(): Promise<AccessPolicyEmailsDTO> {
  return fetch(BASE).then(parseOrThrow);
}

export function addAccessPolicyEmail(email: string): Promise<AccessPolicyEmailsDTO> {
  return fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  }).then(parseOrThrow);
}

export function removeAccessPolicyEmail(email: string): Promise<AccessPolicyEmailsDTO> {
  return fetch(BASE, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  }).then(parseOrThrow);
}
