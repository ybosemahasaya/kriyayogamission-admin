import type { ContactMessageDTO, ContactMessageStatus } from "../../../shared/contact-messages";
import { TrashIcon } from "../icons";
import { STATUS_LABELS, STATUS_ORDER } from "./status-labels";
import { getAvatarColor, getInitials } from "./avatar-utils";

interface Props {
  message: ContactMessageDTO;
  onBack: () => void;
  onStatusChange: (message: ContactMessageDTO, status: ContactMessageStatus) => void;
  onDelete: (message: ContactMessageDTO) => void;
}

/** The "open message" reading pane -- shown alongside (desktop) or
 * instead of (narrow viewports, via onBack) the list. Carries everything
 * ContactMessageListItem deliberately leaves out: full address, full
 * message body, status/backfilled/unconfirmed badges, and the
 * status-change/delete actions. */
export function ContactMessageDetailPane({ message, onBack, onStatusChange, onDelete }: Props) {
  return (
    <div className="contact-mail-detail">
      <button type="button" className="contact-mail-back-btn" onClick={onBack} aria-label="Back to list">
        &#8592; Back
      </button>

      <div className="contact-mail-detail-header">
        <span className="contact-mail-avatar contact-mail-avatar-lg" style={{ background: getAvatarColor(message.email) }}>
          {getInitials(message.name)}
        </span>
        <div className="contact-mail-detail-identity">
          <strong>{message.name}</strong>
          <a href={`mailto:${message.email}`}>{message.email}</a>
          {message.phone && <span className="contact-message-phone">{message.phone}</span>}
        </div>
        <time className="contact-mail-detail-time" dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </div>

      <div className="contact-mail-detail-badges">
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
