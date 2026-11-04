import { useState } from "react";
import { GALLERY_CATEGORIES, type GalleryCategory } from "../../shared/gallery-categories";
import { uploadImage } from "../api/gallery";

interface Props {
  onUploaded: () => void;
}

const emptyState = {
  category: GALLERY_CATEGORIES[0] as GalleryCategory,
  caption: "",
  altText: "",
};

export function UploadForm({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState(emptyState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setPreview(picked ? URL.createObjectURL(picked) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose an image file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await uploadImage({ file, ...form });
      setFile(null);
      setPreview(null);
      setForm(emptyState);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Image file</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
      </label>

      {preview && <img className="upload-preview" src={preview} alt="Preview of selected upload" />}

      <label className="field">
        <span>Category</span>
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value as GalleryCategory })}
        >
          {GALLERY_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Caption</span>
        <input
          type="text"
          value={form.caption}
          onChange={(e) => setForm({ ...form, caption: e.target.value })}
          placeholder="Shown under the photo on the public gallery"
        />
      </label>

      <label className="field">
        <span>Alt text (required, for accessibility)</span>
        <input
          type="text"
          value={form.altText}
          onChange={(e) => setForm({ ...form, altText: e.target.value })}
          placeholder="Describe the photo for screen readers"
          required
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
