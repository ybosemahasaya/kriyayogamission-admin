import { useState } from "react";
import { GALLERY_CATEGORIES, type GalleryCategory } from "../../shared/gallery-categories";
import { uploadImage } from "../api/gallery";
import { TrashIcon } from "./icons";

interface Props {
  onUploaded: () => void;
}

type UploadStatus = "pending" | "uploading" | "done" | "error";

interface PendingFile {
  key: string; // stable React key, independent of file name collisions
  file: File;
  preview: string;
  caption: string;
  altText: string;
  status: UploadStatus;
  error?: string;
}

function toPendingFile(file: File): PendingFile {
  return {
    key: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    preview: URL.createObjectURL(file),
    caption: "",
    altText: "",
    status: "pending",
  };
}

/** One shared category applies to the whole batch -- matches "upload for
 * a category" -- but caption/alt text stay per-photo since they describe
 * one specific image each. Alt text is still required per-photo for
 * accessibility; there's no safe generic default to fall back to. */
export function UploadForm({ onUploaded }: Props) {
  const [category, setCategory] = useState<GalleryCategory>(GALLERY_CATEGORIES[0]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [quickCaption, setQuickCaption] = useState("");
  const [quickAltText, setQuickAltText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function applyQuickFillToAll() {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "uploading" || f.status === "done"
          ? f
          : { ...f, caption: quickCaption, altText: quickAltText },
      ),
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setFiles((prev) => [...prev, ...picked.map(toPendingFile)]);
    e.target.value = ""; // allow picking the same file again after removing it
  }

  function updateFile(key: string, patch: Partial<PendingFile>) {
    setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function removeFile(key: string) {
    setFiles((prev) => {
      const target = prev.find((f) => f.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.key !== key);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (files.length === 0) {
      setFormError("Choose at least one image file.");
      return;
    }
    if (files.some((f) => !f.altText.trim())) {
      setFormError("Every photo needs alt text before it can be uploaded.");
      return;
    }

    setSubmitting(true);

    // Sequential, not parallel: each successful upload schedules a
    // Cloudflare Deploy Hook call (see worker/lib/deploy-hook.ts), and
    // firing a dozen of those in a tight burst risks tripping its
    // per-minute rate limit. Slower, but every upload's trigger lands.
    let anyFailed = false;
    for (const f of files) {
      if (f.status === "done") continue; // allow retrying just the failed ones
      updateFile(f.key, { status: "uploading", error: undefined });
      try {
        await uploadImage({ file: f.file, category, caption: f.caption, altText: f.altText });
        updateFile(f.key, { status: "done" });
      } catch (err) {
        anyFailed = true;
        updateFile(f.key, { status: "error", error: err instanceof Error ? err.message : "Upload failed." });
      }
    }

    setSubmitting(false);
    if (!anyFailed) {
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      onUploaded();
    } else {
      setFormError("Some photos failed to upload -- fix them below and submit again. Successful ones won't re-upload.");
    }
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Category (applies to all photos in this batch)</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as GalleryCategory)}>
          {GALLERY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Image files (select multiple to upload at once)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileChange} />
      </label>

      {files.length > 1 && (
        <div className="quick-fill">
          <p className="quick-fill-label">Fill every photo below at once (still editable per-photo after):</p>
          <input
            type="text"
            value={quickCaption}
            placeholder="Caption to apply to all"
            onChange={(e) => setQuickCaption(e.target.value)}
          />
          <input
            type="text"
            value={quickAltText}
            placeholder="Alt text to apply to all"
            onChange={(e) => setQuickAltText(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={applyQuickFillToAll}>
            Apply to all
          </button>
          <p className="quick-fill-warning">
            Heads up: identical alt text on different photos makes them indistinguishable to screen reader
            users and hurts image search indexing. Fine for truly interchangeable shots from the same moment --
            otherwise, tweak each one below after applying.
          </p>
        </div>
      )}

      {files.length > 0 && (
        <div className="upload-batch-list">
          {files.map((f) => (
            <div key={f.key} className={`upload-batch-item upload-batch-item-${f.status}`}>
              <img className="upload-batch-thumb" src={f.preview} alt="" />
              <div className="upload-batch-fields">
                <input
                  type="text"
                  value={f.caption}
                  placeholder="Caption (optional)"
                  disabled={f.status === "uploading" || f.status === "done"}
                  onChange={(e) => updateFile(f.key, { caption: e.target.value })}
                />
                <input
                  type="text"
                  value={f.altText}
                  placeholder="Alt text (required)"
                  required
                  disabled={f.status === "uploading" || f.status === "done"}
                  onChange={(e) => updateFile(f.key, { altText: e.target.value })}
                />
                {f.status === "error" && <p className="form-error">{f.error}</p>}
              </div>
              <span className="upload-batch-status" aria-label={f.status}>
                {f.status === "uploading" && "Uploading..."}
                {f.status === "done" && "Done"}
                {f.status === "error" && "Failed"}
              </span>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                title="Remove from batch"
                onClick={() => removeFile(f.key)}
                disabled={f.status === "uploading"}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {formError && <p className="form-error">{formError}</p>}

      <button type="submit" className="btn-primary" disabled={submitting || files.length === 0}>
        {submitting
          ? "Uploading..."
          : files.length > 1
            ? `Upload ${files.length} photos`
            : "Upload"}
      </button>
    </form>
  );
}
