import { useCallback, useEffect, useMemo, useState } from "react";
import { bulkDeleteImages, listImages } from "./api/gallery";
import { BulkActionBar } from "./components/BulkActionBar";
import { BulkEditModal } from "./components/BulkEditModal";
import { EditImageModal } from "./components/EditImageModal";
import { GalleryGrid } from "./components/GalleryGrid";
import { Modal } from "./components/Modal";
import { Sidebar } from "./components/Sidebar";
import { UploadForm } from "./components/UploadForm";
import { PlusIcon, SearchIcon } from "./components/icons";
import { useTheme } from "./hooks/useTheme";
import { GALLERY_CATEGORIES, type GalleryCategory } from "../shared/gallery-categories";
import type { GalleryImageDTO } from "../shared/gallery-image";
import "./App.css";

type Tab = "published" | "drafts";

function App() {
  const [images, setImages] = useState<GalleryImageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("published");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<GalleryCategory | "all">("all");

  const [showUpload, setShowUpload] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImageDTO | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  const { theme, toggleTheme } = useTheme();

  const refresh = useCallback(() => {
    setLoading(true);
    listImages()
      .then(setImages)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load gallery."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A selection made under one filter (e.g. "Drafts" tab) stops making
  // sense once the filter changes and different photos are on screen --
  // clear it rather than silently acting on photos the admin can no
  // longer see.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, categoryFilter, search]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} selected photo${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
    await bulkDeleteImages([...selectedIds]);
    setSelectedIds(new Set());
    refresh();
  }

  const filteredImages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return images.filter((image) => {
      if (tab === "published" && !image.published) return false;
      if (tab === "drafts" && image.published) return false;
      if (categoryFilter !== "all" && image.category !== categoryFilter) return false;
      if (query && !image.caption.toLowerCase().includes(query) && !image.altText.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [images, tab, categoryFilter, search]);

  const publishedCount = images.filter((i) => i.published).length;
  const draftCount = images.length - publishedCount;

  return (
    <div className="app-shell">
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />

      <main className="app-main">
        <header className="main-header">
          <h1>Gallery</h1>
          <p>Manage the photos shown on the public Kriya Yoga Mission gallery.</p>
        </header>

        <div className="tabs">
          <button
            type="button"
            className={tab === "published" ? "tab active" : "tab"}
            onClick={() => setTab("published")}
          >
            Published <span className="tab-count">{publishedCount}</span>
          </button>
          <button type="button" className={tab === "drafts" ? "tab active" : "tab"} onClick={() => setTab("drafts")}>
            Drafts <span className="tab-count">{draftCount}</span>
          </button>
        </div>

        <div className="toolbar">
          <div className="search-input">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search caption or alt text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="category-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as GalleryCategory | "all")}
          >
            <option value="all">All categories</option>
            {GALLERY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <button type="button" className="btn-primary" onClick={() => setShowUpload(true)}>
            <PlusIcon /> Add Photo
          </button>
        </div>

        <BulkActionBar
          count={selectedIds.size}
          onBulkEdit={() => setShowBulkEdit(true)}
          onBulkDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />

        {loading && <p className="empty-state">Loading...</p>}
        {error && <p className="form-error">{error}</p>}
        {!loading && !error && (
          <GalleryGrid
            images={filteredImages}
            emptyMessage={
              tab === "published"
                ? "No published photos match the current filters."
                : "No drafts -- unpublish a photo to park it here."
            }
            onChanged={refresh}
            onEdit={setEditingImage}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        )}
      </main>

      {showUpload && (
        <Modal title="Add photo" onClose={() => setShowUpload(false)}>
          <UploadForm
            onUploaded={() => {
              setShowUpload(false);
              refresh();
            }}
          />
        </Modal>
      )}

      {editingImage && (
        <Modal title="Edit photo" onClose={() => setEditingImage(null)}>
          <EditImageModal
            image={editingImage}
            onSaved={() => {
              setEditingImage(null);
              refresh();
            }}
          />
        </Modal>
      )}

      {showBulkEdit && (
        <Modal title="Edit selected photos" onClose={() => setShowBulkEdit(false)}>
          <BulkEditModal
            count={selectedIds.size}
            imageIds={[...selectedIds]}
            onSaved={() => {
              setShowBulkEdit(false);
              setSelectedIds(new Set());
              refresh();
            }}
            onCancel={() => setShowBulkEdit(false)}
          />
        </Modal>
      )}
    </div>
  );
}

export default App;
