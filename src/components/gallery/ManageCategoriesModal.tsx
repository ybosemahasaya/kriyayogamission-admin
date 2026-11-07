import { useState } from "react";
import type { GalleryCategoryDTO } from "../../../shared/gallery-categories";
import { createCategory, deleteCategory, renameCategory } from "../../api/gallery-categories";
import { EditIcon, PlusIcon, TrashIcon } from "../icons";

interface Props {
  categories: GalleryCategoryDTO[];
  /** Re-fetches both categories and the image list in App.tsx -- a
   * rename cascades to every photo using the old category name, so the
   * gallery grid's category labels need refreshing too, not just this
   * list. */
  onChanged: () => void;
}

/** Add/rename/delete gallery categories. Renaming or deleting here is
 * picked up by the public site the next time it rebuilds (same
 * Cloudflare Deploy Hook trigger every other gallery mutation already
 * uses -- see worker/lib/deploy-hook.ts), typically within a couple of
 * minutes. Deleting a category that still has photos in it is blocked
 * by the API with a clear count, not silently cascaded or reassigned --
 * see worker/api/gallery-categories.ts's `remove` for why. */
export function ManageCategoriesModal({ categories, onChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      await createCategory(name);
      setNewName("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setAdding(false);
    }
  }

  function startEditing(category: GalleryCategoryDTO) {
    setError(null);
    setEditingId(category.id);
    setEditingName(category.name);
  }

  async function handleRename(id: string) {
    const name = editingName.trim();
    if (!name) return;
    setBusyId(id);
    setError(null);
    try {
      await renameCategory(id, name);
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename category.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(category: GalleryCategoryDTO) {
    if (!window.confirm(`Delete category "${category.name}"? This only works if no photos use it.`)) return;
    setBusyId(category.id);
    setError(null);
    try {
      await deleteCategory(category.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="manage-categories">
      <p className="manage-categories-intro">
        Categories shown here appear as filter tabs on the public gallery. Renaming updates every photo
        already filed under the old name; deleting is blocked while any photo still uses it.
      </p>

      <ul className="manage-categories-list">
        {categories.map((category) => (
          <li key={category.id} className="manage-categories-row">
            {editingId === category.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  autoFocus
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busyId === category.id}
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === category.id}
                  onClick={() => handleRename(category.id)}
                >
                  {busyId === category.id ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                <span className="manage-categories-name">{category.name}</span>
                <button
                  type="button"
                  className="icon-btn"
                  title="Rename"
                  disabled={busyId === category.id}
                  onClick={() => startEditing(category)}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  title="Delete"
                  disabled={busyId === category.id}
                  onClick={() => handleDelete(category)}
                >
                  <TrashIcon />
                </button>
              </>
            )}
          </li>
        ))}
        {categories.length === 0 && <p className="empty-state">No categories yet -- add one below.</p>}
      </ul>

      {error && <p className="form-error">{error}</p>}

      <form className="manage-categories-add" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={adding || !newName.trim()}>
          <PlusIcon /> {adding ? "Adding..." : "Add category"}
        </button>
      </form>
    </div>
  );
}
