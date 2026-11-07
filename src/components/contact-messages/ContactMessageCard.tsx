import { useState } from "react";
import type { ContactMessageDTO, ContactMessageStatus } from "../../../shared/contact-messages";
import { TrashIcon } from "../icons";
import { STATUS_LABELS, STATUS_ORDER } from "./status-labels";

interface Props {
  message: ContactMessageDTO;
  onStatusChange: (message: ContactMessageDTO, status: ContactMessageStatus) => void;
  onDelete: (message: ContactMessageDTO) => void;
}

/** One submission from the public contact form, persisted independently
 * of whether its notification email ever reached Resend -- see
 * migrations/0004_create_contact_messages.sql. The "unconfirmed" badge
 * below is the whole point of this feature: it's the one place an admin
 * can actually SEE a submission that the old email-only flow would have
 * silently dropped.
 *
 * Collapsed by default -- with potentially years of historical messages
 * (see the Resend backfill), a list that renders every full message body
 * at once would be an unscannable wall of text. Clicking the header row
 * expands just that one card; this is local component state, not lifted
 * to the page, so each card's expansion is independent and nothing needs
 * to re-fetch or re-render the rest of the list. */
export function ContactMessageCard({ message, onStatusChange, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="contact-message-card">
      <button
        type="button"
        className="contact-message-card-header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className={`contact-message-chevron ${expanded ? "contact-message-chevron-open" : ""}`}>&#9656;</span>
        <div className="contact-message-card-identity">
          <strong>{message.name}</strong>
          <span className="contact-message-email-text">{message.email}</span>
          {message.phone && <span className="contact-message-phone">{message.phone}</span>}
          {!expanded && <span className="contact-message-preview">{message.message}</span>}
        </div>
        <div className="contact-message-card-meta">
          <span className={`contact-status-badge contact-status-${message.status}`}>{STATUS_LABELS[message.status]}</span>
          {message.backfilled && (
            <span
              className="contact-backfilled-badge"
              title="Reconstructed from Resend's send history after the fact -- created-at is the notification email's send time, and this message was never captured by the live ingest flow."
            >
              Imported from Resend
            </span>
          )}
          {!message.emailSent && (
            <span
              className="contact-email-failed-badge"
              title="The notification email to the organization never confirmed as sent via Resend -- this record is the safety net for exactly that case."
            >
              &#9888; Notification unconfirmed
            </span>
          )}
          <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
        </div>
      </button>

      {expanded && (
        <div className="contact-message-card-body">
          <p className="contact-message-card-email-link">
            <a href={`mailto:${message.email}`}>{message.email}</a>
          </p>
          {message.address && <p className="contact-message-address">{message.address}</p>}
          <p className="contact-message-body">{message.message}</p>

          <div className="contact-message-card-actions">
            <select
              aria-label="Status"
              value={message.status}
              onChange={(e) => onStatusChange(message, e.target.value as ContactMessageStatus)}
            >
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <button type="button" className="icon-btn icon-btn-danger" title="Delete" onClick={() => onDelete(message)}>
              <TrashIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
