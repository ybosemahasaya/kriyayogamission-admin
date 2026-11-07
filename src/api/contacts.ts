import type { ContactDirectoryResponse } from "../../shared/contacts";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed with ${res.status}`);
  }
  return res.json();
}

export function listContactDirectory(): Promise<ContactDirectoryResponse> {
  return fetch("/api/contacts").then(parseOrThrow);
}
