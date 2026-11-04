import { useState } from "react";
import type { GalleryImageDTO } from "../../shared/gallery-image";
import { deleteImage, updateImage } from "../api/gallery";
import { EditIcon, EyeIcon, EyeOffIcon, TrashIcon } from "./icons";

interface Props {
  images: GalleryImageDTO[];
  emptyMessage: string;
  onChanged: () => void;
  onEdit: (image: GalleryImageDTO) => void;
}

export function GalleryGrid({ images, emptyMessage, onChanged, onEdit }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this photo? This cannot be undone.")) return;
    setBusyId(id);
    try {
      await deleteImage(id);
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePublished(image: GalleryImageDTO) {
    setBusyId(image.id);
    try {
      await updateImage(image.id, { published: !image.published });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  if (images.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="gallery-grid">
      {images.map((image) => (
        <article key={image.id} className="gallery-card">
          <div className="card-media">
            <img src={`/images/${image.src}`} alt={image.altText} loading="lazy" />
            <span className="card-category-badge">{image.category}</span>
            <div className="card-actions">
              <button
                type="button"
                className="icon-btn"
                title="Edit"
                onClick={() => onEdit(image)}
                disabled={busyId === image.id}
              >
                <EditIcon />
              </button>
              <button
                type="button"
                className="icon-btn"
                title={image.published ? "Unpublish" : "Publish"}
                onClick={() => handleTogglePublished(image)}
                disabled={busyId === image.id}
              >
                {image.published ? <EyeIcon /> : <EyeOffIcon />}
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                title="Delete"
                onClick={() => handleDelete(image.id)}
                disabled={busyId === image.id}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
          <div className="card-body">
            <p className="card-caption">{image.caption || <em>No caption</em>}</p>
            <p className="card-alt">{image.altText}</p>
            <p className="card-footer">
              {image.uploadedBy} · {new Date(image.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
