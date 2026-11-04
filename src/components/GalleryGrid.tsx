import type { GalleryImageDTO } from "../../shared/gallery-image";
import { deleteImage } from "../api/gallery";

interface Props {
  images: GalleryImageDTO[];
  onChanged: () => void;
}

export function GalleryGrid({ images, onChanged }: Props) {
  async function handleDelete(id: string) {
    if (!window.confirm("Delete this photo? This cannot be undone.")) return;
    await deleteImage(id);
    onChanged();
  }

  if (images.length === 0) {
    return <p className="empty-state">No photos yet -- upload the first one above.</p>;
  }

  return (
    <div className="gallery-grid">
      {images.map((image) => (
        <article key={image.id} className="gallery-card">
          {/* Served from R2 once a public read path is wired up; shows the
             raw key for now so uploads are verifiable end-to-end. */}
          <div className="gallery-thumb-placeholder" title={image.src}>
            {image.src}
          </div>
          <div className="gallery-meta">
            <span className="gallery-category">{image.category}</span>
            <p className="gallery-caption">{image.caption || <em>No caption</em>}</p>
            <p className="gallery-alt">alt: {image.altText}</p>
          </div>
          <button type="button" className="danger" onClick={() => handleDelete(image.id)}>
            Delete
          </button>
        </article>
      ))}
    </div>
  );
}
