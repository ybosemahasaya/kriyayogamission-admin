import type { GalleryCategoryDTO } from "../../shared/gallery-categories";

const BASE = "/api/gallery-categories";

async function parseOrThrow(res: Response) {
  if (res.ok) return res.status === 204 ? null : res.json();
  const body = await res.json().catch(() => ({ error: res.statusText }));
  throw new Error(body.error ?? `Request failed with ${res.status}`);
}

export function listCategories(): Promise<GalleryCategoryDTO[]> {
  return fetch(BASE).then(parseOrThrow);
}

export function createCategory(name: string): Promise<GalleryCategoryDTO> {
  return fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  }).then(parseOrThrow);
}

export function renameCategory(id: string, name: string): Promise<{ id: string; name: string }> {
  return fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  }).then(parseOrThrow);
}

export function deleteCategory(id: string): Promise<null> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then(parseOrThrow);
}
