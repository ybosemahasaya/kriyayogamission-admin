import { useCallback, useRef, useState } from "react";
import { uploadImage, type UploadImageInput } from "../api/gallery";

export type QueueItemStatus = "pending" | "uploading" | "done" | "error";

export interface QueueItem {
  key: string;
  fileName: string;
  percent: number; // 0-100, real upload progress via XHR
  status: QueueItemStatus;
  error?: string;
}

export interface QueuedUpload extends UploadImageInput {
  key: string;
}

/**
 * Drives the "Add Photo" modal's actual uploads *after* the modal has
 * already closed, so a batch of photos keeps uploading in the background
 * while the admin goes back to looking at the gallery -- see
 * UploadProgressPanel for where this state gets rendered.
 *
 * Uploads are drained one at a time from a plain ref-backed queue (not
 * Promise.all) for the same reason the old in-modal version was
 * sequential: each successful upload schedules a Cloudflare Deploy Hook
 * call (worker/lib/deploy-hook.ts) with a 10/minute rate limit, so
 * bursting many uploads in parallel risks dropping some of those
 * triggers. The queue is a ref (not state) specifically so enqueue()
 * calls made while a drain loop is already running get picked up by
 * that same loop instead of racing it.
 */
export function useUploadQueue(onItemSettled: () => void) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const pendingRef = useRef<QueuedUpload[]>([]);
  const draining = useRef(false);

  const updateItem = useCallback((key: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    while (pendingRef.current.length > 0) {
      const next = pendingRef.current.shift();
      if (!next) break;
      updateItem(next.key, { status: "uploading", percent: 0 });
      try {
        await uploadImage(next, (percent) => updateItem(next.key, { percent }));
        updateItem(next.key, { status: "done", percent: 100 });
      } catch (err) {
        updateItem(next.key, { status: "error", error: err instanceof Error ? err.message : "Upload failed." });
      }
      onItemSettled();
    }
    draining.current = false;
  }, [onItemSettled, updateItem]);

  function enqueue(batch: QueuedUpload[]) {
    pendingRef.current.push(...batch);
    setItems((prev) => [
      ...prev,
      ...batch.map((b) => ({ key: b.key, fileName: b.file.name, percent: 0, status: "pending" as const })),
    ]);
    drain();
  }

  function dismiss() {
    // Only hides the panel. Anything still in pendingRef keeps uploading
    // in the background regardless -- dismissing is a UI choice, not a
    // cancel button (there isn't one; see UploadProgressPanel).
    setItems([]);
  }

  return { items, enqueue, dismiss };
}
