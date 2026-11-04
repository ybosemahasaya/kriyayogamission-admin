import { useCallback, useEffect, useState } from "react";
import { listImages } from "./api/gallery";
import { GalleryGrid } from "./components/GalleryGrid";
import { UploadForm } from "./components/UploadForm";
import type { GalleryImageDTO } from "../shared/gallery-image";
import "./App.css";

function App() {
  const [images, setImages] = useState<GalleryImageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <header className="app-header">
        <h1>Kriya Yoga Mission — Admin</h1>
        <p>Gallery upload console. Access is gated by Cloudflare Access at the edge.</p>
      </header>

      <main className="app-main">
        <UploadForm onUploaded={refresh} />

        <section>
          <h2>Current photos</h2>
          {loading && <p>Loading...</p>}
          {error && <p className="form-error">{error}</p>}
          {!loading && !error && <GalleryGrid images={images} onChanged={refresh} />}
        </section>
      </main>
    </>
  );
}

export default App;
