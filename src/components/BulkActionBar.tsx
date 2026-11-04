interface Props {
  count: number;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  onClear: () => void;
}

/** Sticky bar shown above the gallery grid whenever one or more photos
 * are selected. Kept as its own component (not inlined in App.tsx) so
 * it's trivial to test/reason about in isolation, matching how Modal and
 * the other small pieces here are split out. */
export function BulkActionBar({ count, onBulkEdit, onBulkDelete, onClear }: Props) {
  if (count === 0) return null;

  return (
    <div className="bulk-action-bar">
      <span className="bulk-action-count">{count} selected</span>
      <div className="bulk-action-buttons">
        <button type="button" className="btn-secondary" onClick={onBulkEdit}>
          Edit selected
        </button>
        <button type="button" className="btn-secondary btn-danger-outline" onClick={onBulkDelete}>
          Delete selected
        </button>
        <button type="button" className="btn-link" onClick={onClear}>
          Clear selection
        </button>
      </div>
    </div>
  );
}
