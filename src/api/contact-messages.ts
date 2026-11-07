import type {
  ContactMessageBackfillResult,
  ContactMessageDTO,
  ContactMessageListResponse,
  ContactMessageStatus,
} from "../../shared/contact-messages";
import type { EmailMetricsDTO } from "../../shared/email-metrics";

const BASE = "/api/contact-messages";

async function parseOrThrow(res: Response) {
  if (res.ok) return res.status === 204 ? null : res.json();
  const body = await res.json().catch(() => ({ error: res.statusText }));
  throw new Error(body.error ?? `Request failed with ${res.status}`);
}

export function listContactMessages(status?: ContactMessageStatus | "all"): Promise<ContactMessageListResponse> {
  const url = status && status !== "all" ? `${BASE}?status=${status}` : BASE;
  return fetch(url).then(parseOrThrow);
}

export function updateContactMessageStatus(id: string, status: ContactMessageStatus): Promise<ContactMessageDTO> {
  return fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  }).then(parseOrThrow);
}

export function deleteContactMessage(id: string): Promise<null> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then(parseOrThrow);
}

export function getEmailMetrics(): Promise<EmailMetricsDTO> {
  return fetch("/api/email-metrics").then(parseOrThrow);
}

export function backfillContactMessagesFromResend(): Promise<ContactMessageBackfillResult> {
  return fetch(`${BASE}/backfill-from-resend`, { method: "POST" }).then(parseOrThrow);
}
