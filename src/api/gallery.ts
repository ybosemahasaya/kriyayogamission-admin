import type { GalleryCategory } from "../../shared/gallery-categories";
import type { GalleryImageDTO } from "../../shared/gallery-image";

const BASE = "/api/gallery";

async function parseOrThrow(res: Response) {
  if (res.ok) return res.status === 204 ? null : res.json();
  const body = await res.json().catch(() => ({ error: res.statusText }));
  throw new Error(body.error ?? `Request failed with ${res.status}`);
}

export function listImages(): Promise<GalleryImageDTO[]> {
  return fetch(BASE).then(parseOrThrow);
}

export interface UploadImageInput {
  file: File;
  category: GalleryCategory;
  caption: string;
  altText: string;
}

export function uploadImage(input: UploadImageInput): Promise<{ id: string }> {
  const form = new FormData();
  form.set("file", input.file);
  form.set("category", input.category);
  form.set("caption", input.caption);
  form.set("altText", input.altText);
  return fetch(BASE, { method: "POST", body: form }).then(parseOrThrow);
}

export function updateImage(
  id: string,
  patch: Partial<Pick<GalleryImageDTO, "caption" | "category" | "displayOrder" | "published">>,
): Promise<GalleryImageDTO> {
  return fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  }).then(parseOrThrow);
}

export function deleteImage(id: string): Promise<null> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then(parseOrThrow);
}
