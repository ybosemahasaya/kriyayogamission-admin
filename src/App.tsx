import { useCallback, useEffect, useMemo, useState } from "react";
import { bulkDeleteImages, listImages } from "./api/gallery";
import { listCategories } from "./api/gallery-categories";
import { BulkActionBar } from "./components/BulkActionBar";
import { BulkEditModal } from "./components/BulkEditModal";
import { ContactMessagesPage } from "./components/ContactMessagesPage";
import { EditImageModal } from "./components/EditImageModal";
import { EdgeAnalyticsPage } from "./components/EdgeAnalyticsPage";
import { Ga4Page } from "./components/Ga4Page";
import { ManageCategoriesModal } from "./components/gallery/ManageCategoriesModal";
import { GalleryGrid } from "./components/GalleryGrid";
import { Modal } from "./components/Modal";
import { ProfileMenu } from "./components/ProfileMenu";
import { QuickLinksPage } from "./components/QuickLinksPage";
import { SearchConsolePage } from "./components/SearchConsolePage";
import { Sidebar, type SidebarView } from "./components/Sidebar";
import { SiteAuditPage } from "./components/SiteAuditPage";
import { UploadForm } from "./components/UploadForm";
import { UploadProgressPanel } from "./components/UploadProgressPanel";
import { PlusIcon, SearchIcon, SettingsIcon } from "./components/icons";
import { useTheme } from "./hooks/useTheme";
import { useUploadQueue, type QueuedUpload } from "./hooks/useUploadQueue";
import type { GalleryCategoryDTO } from "../shared/gallery-categories";
import type { GalleryImageDTO } from "../shared/gallery-image";
import "./App.css";

type Tab = "published" | "drafts";

function App() {
  const [view, setView] = useState<SidebarView>("gallery");
  const [images, setImages] = useState<GalleryImageDTO[]>([]);
  const [categories, setCategories] = useState<GalleryCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("published");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");

  const [showUpload, setShowUpload] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImageDTO | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);

  const { theme, toggleTheme } = useTheme();

  const refresh = useCallback(() => {
    setLoading(true);
    listImages()
      .then(setImages)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load gallery."))
      .finally(() => setLoading(false));
  }, []);

  const refreshCategories = useCallback(() => {
    listCategories()
      .then(setCategories)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load categories."));
  }, []);

  useEffect(() => {
    refresh();
    refreshCategories();
  }, [refresh, refreshCategories]);

  // Refresh after each individual upload settles (not just at the end of
  // the whole batch) so photos appear in the grid progressively as they
  // land, instead of all at once after a potentially long batch finishes.
  const uploadQueue = useUploadQueue(refresh);

  function handleStartUpload(items: QueuedUpload[]) {
    uploadQueue.enqueue(items);
    setShowUpload(false);
  }

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
      <Sidebar theme={theme} onToggleTheme={toggleTheme} activeView={view} onNavigate={setView} />

      <main className="app-main">
        {view === "contact-messages" ? (
          <>
            <header className="main-header">
              <h1>Contact Messages</h1>
              <p>Every submission from the public contact form, persisted regardless of whether its notification email reached Resend.</p>
            </header>
            <ContactMessagesPage />
          </>
        ) : view === "ga4" ? (
          <>
            <header className="main-header">
              <h1>GA4</h1>
              <p>Traffic and engagement for kriyayogamission.org, straight from GA4.</p>
            </header>
            <Ga4Page theme={theme} />
          </>
        ) : view === "search-console" ? (
          <>
            <header className="main-header">
              <h1>Search Console</h1>
              <p>How kriyayogamission.org shows up in Google Search, and what people search to find it.</p>
            </header>
            <SearchConsolePage />
          </>
        ) : view === "edge-analytics" ? (
          <>
            <header className="main-header">
              <h1>Edge Analytics</h1>
              <p>
                Server-side truth from Cloudflare's edge for kriyayogamission.org -- bot/WAF-blocked traffic, cache
                hit ratio, and bandwidth that GA4 structurally cannot see.
              </p>
            </header>
            <EdgeAnalyticsPage theme={theme} />
          </>
        ) : view === "site-audit" ? (
          <>
            <header className="main-header">
              <h1>Site Audit</h1>
              <p>Crawl kriyayogamission.org's own public pages and flag technical SEO issues.</p>
            </header>
            <SiteAuditPage theme={theme} />
          </>
        ) : view === "links" ? (
          <>
            <header className="main-header">
              <h1>Quick Links</h1>
              <p>Jump straight to the external tools and dashboards this project depends on.</p>
            </header>
            <QuickLinksPage />
          </>
        ) : (
          <>
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
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>

              <button type="button" className="btn-secondary" onClick={() => setShowManageCategories(true)}>
                <SettingsIcon /> Manage Categories
              </button>

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
          </>
        )}
      </main>

      {showUpload && (
        <Modal title="Add photo" onClose={() => setShowUpload(false)}>
          <UploadForm categories={categories} onStartUpload={handleStartUpload} />
        </Modal>
      )}

      {showManageCategories && (
        <Modal title="Manage categories" onClose={() => setShowManageCategories(false)}>
          <ManageCategoriesModal
            categories={categories}
            onChanged={() => {
              refreshCategories();
              refresh();
            }}
          />
        </Modal>
      )}

      {editingImage && (
        <Modal title="Edit photo" onClose={() => setEditingImage(null)}>
          <EditImageModal
            image={editingImage}
            categories={categories}
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
            categories={categories}
            onSaved={() => {
              setShowBulkEdit(false);
              setSelectedIds(new Set());
              refresh();
            }}
            onCancel={() => setShowBulkEdit(false)}
          />
        </Modal>
      )}

      <UploadProgressPanel items={uploadQueue.items} onDismiss={uploadQueue.dismiss} />
      <ProfileMenu />
    </div>
  );
}

export default App;
