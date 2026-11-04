import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Generic overlay + panel used for both "Add photo" and "Edit photo".
 * Deliberately dumb -- no focus trapping or animation libraries, just
 * enough to look right and let Escape/backdrop-click dismiss it. */
export function Modal({ title, onClose, children }: Props) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
