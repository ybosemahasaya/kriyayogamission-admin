import type { QueueItem } from "../hooks/useUploadQueue";
import { CloseIcon } from "./icons";

interface Props {
  items: QueueItem[];
  onDismiss: () => void;
}

/** Fixed bottom-right panel, shown automatically the moment an upload
 * batch starts (no action needed to open it) and updated live as each
 * file's real upload percentage comes in via XHR progress events. Stays
 * up after everything settles so the admin can see what failed, with a
 * manual dismiss -- no auto-hide timer, since someone stepping away from
 * their screen shouldn't come back to a vanished error. */
export function UploadProgressPanel({ items, onDismiss }: Props) {
  if (items.length === 0) return null;

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const settledCount = doneCount + errorCount;
  const allSettled = settledCount === items.length;
  const overallPercent = Math.round(
    items.reduce((sum, i) => sum + (i.status === "done" ? 100 : i.percent), 0) / items.length,
  );

  return (
    <div className="upload-progress-panel" role="status" aria-live="polite">
      <div className="upload-progress-header">
        <span>
          {allSettled
            ? `Uploaded ${doneCount} of ${items.length}${errorCount > 0 ? ` (${errorCount} failed)` : ""}`
            : `Uploading ${settledCount + 1} of ${items.length} (${overallPercent}%)`}
        </span>
        <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss upload progress" title="Dismiss">
          <CloseIcon />
        </button>
      </div>

      <div className="upload-progress-overall-bar">
        <div className="upload-progress-overall-fill" style={{ width: `${overallPercent}%` }} />
      </div>

      <div className="upload-progress-list">
        {items.map((item) => (
          <div key={item.key} className={`upload-progress-item upload-progress-item-${item.status}`}>
            <span className="upload-progress-filename" title={item.fileName}>
              {item.fileName}
            </span>
            {item.status === "error" ? (
              <span className="upload-progress-error">{item.error ?? "Failed"}</span>
            ) : (
              <div className="upload-progress-bar">
                <div
                  className="upload-progress-fill"
                  style={{ width: `${item.status === "done" ? 100 : item.percent}%` }}
                />
              </div>
            )}
            <span className="upload-progress-percent">
              {item.status === "done" && "Done"}
              {item.status === "error" && "Failed"}
              {(item.status === "pending" || item.status === "uploading") && `${item.percent}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
