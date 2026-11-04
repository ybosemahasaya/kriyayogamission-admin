import { useState } from "react";
import { GALLERY_CATEGORIES, type GalleryCategory } from "../../shared/gallery-categories";
import { bulkUpdateImages } from "../api/gallery";

interface Props {
  count: number;
  imageIds: string[];
  onSaved: () => void;
  onCancel: () => void;
}

/** Only category and published are safe to apply uniformly across many
 * *different* photos -- caption/alt text describe one specific image
 * each, so bulk-overwriting them would just clobber distinct captions
 * with the same text. See worker/api/gallery.ts's bulkUpdate for the
 * matching backend-side restriction. Each field is opt-in (checkbox)
 * so leaving a field untouched here genuinely leaves it untouched on
 * every selected photo, not silently reset to some default. */
export function BulkEditModal({ count, imageIds, onSaved, onCancel }: Props) {
  const [changeCategory, setChangeCategory] = useState(false);
  const [category, setCategory] = useState<GalleryCategory>(GALLERY_CATEGORIES[0]);
  const [changePublished, setChangePublished] = useState(false);
  const [published, setPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!changeCategory && !changePublished) {
      setError("Choose at least one change to apply.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await bulkUpdateImages(imageIds, {
        ...(changeCategory ? { category } : {}),
        ...(changePublished ? { published } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <p className="bulk-edit-summary">Applying changes to {count} selected photo{count === 1 ? "" : "s"}.</p>

      <label className="field field-checkbox">
        <input type="checkbox" checked={changeCategory} onChange={(e) => setChangeCategory(e.target.checked)} />
        <span>Change category to:</span>
      </label>
      <select value={category} disabled={!changeCategory} onChange={(e) => setCategory(e.target.value as GalleryCategory)}>
        {GALLERY_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label className="field field-checkbox">
        <input type="checkbox" checked={changePublished} onChange={(e) => setChangePublished(e.target.checked)} />
        <span>Change published status to:</span>
      </label>
      <select
        value={published ? "published" : "draft"}
        disabled={!changePublished}
        onChange={(e) => setPublished(e.target.value === "published")}
      >
        <option value="published">Published</option>
        <option value="draft">Draft (unpublished)</option>
      </select>

      {error && <p className="form-error">{error}</p>}

      <div className="modal-form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : `Apply to ${count} photo${count === 1 ? "" : "s"}`}
        </button>
      </div>
    </form>
  );
}
