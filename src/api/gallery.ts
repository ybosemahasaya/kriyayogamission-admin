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
  category: string;
  caption: string;
  altText: string;
}

export function uploadImage(input: UploadImageInput, onProgress?: (percent: number) => void): Promise<{ id: string }> {
  const form = new FormData();
  form.set("file", input.file);
  form.set("category", input.category);
  form.set("caption", input.caption);
  form.set("altText", input.altText);

  // fetch() has no way to report upload progress -- the Fetch API simply
  // doesn't expose it. XMLHttpRequest's upload.onprogress is the only
  // standard browser API that gives real loaded/total byte counts during
  // an upload, so it's used here specifically to drive the progress bars
  // in UploadProgressPanel.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", BASE);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: { id?: string; error?: string } | null = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.id) {
        resolve({ id: body.id });
      } else {
        reject(new Error(body?.error ?? `Request failed with ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });
}

export function updateImage(
  id: string,
  patch: Partial<Pick<GalleryImageDTO, "caption" | "altText" | "category" | "displayOrder" | "published">>,
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

/** Applied uniformly to many photos at once -- see worker/api/gallery.ts
 * for why this only supports category + published, not caption/altText. */
export function bulkUpdateImages(
  ids: string[],
  patch: Partial<Pick<GalleryImageDTO, "category" | "published">>,
): Promise<{ updated: number }> {
  return fetch(`${BASE}/bulk`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids, patch }),
  }).then(parseOrThrow);
}

export function bulkDeleteImages(ids: string[]): Promise<{ deleted: number }> {
  return fetch(`${BASE}/bulk`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  }).then(parseOrThrow);
}
