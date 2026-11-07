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
 * silently dropped. */
export function ContactMessageCard({ message, onStatusChange, onDelete }: Props) {
  return (
    <div className="contact-message-card">
      <div className="contact-message-card-header">
        <div className="contact-message-card-identity">
          <strong>{message.name}</strong>
          <a href={`mailto:${message.email}`}>{message.email}</a>
          {message.phone && <span className="contact-message-phone">{message.phone}</span>}
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
      </div>

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
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
