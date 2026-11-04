import { useState } from "react";
import { GALLERY_CATEGORIES, type GalleryCategory } from "../../shared/gallery-categories";
import type { GalleryImageDTO } from "../../shared/gallery-image";
import { updateImage } from "../api/gallery";

interface Props {
  image: GalleryImageDTO;
  onSaved: () => void;
}

export function EditImageModal({ image, onSaved }: Props) {
  const [caption, setCaption] = useState(image.caption);
  const [altText, setAltText] = useState(image.altText);
  const [category, setCategory] = useState<GalleryCategory>(image.category);
  const [published, setPublished] = useState(image.published);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateImage(image.id, { caption, altText, category, published });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <img className="edit-preview" src={`/images/${image.src}`} alt={image.altText} />

      <label className="field">
        <span>Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as GalleryCategory)}>
          {GALLERY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Caption</span>
        <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} />
      </label>

      <label className="field">
        <span>Alt text</span>
        <input type="text" value={altText} onChange={(e) => setAltText(e.target.value)} required />
      </label>

      <label className="field field-checkbox">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        <span>Published</span>
      </label>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
