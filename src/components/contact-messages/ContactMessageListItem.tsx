import type { ContactMessageDTO } from "../../../shared/contact-messages";
import { formatRelativeOrDate, getAvatarColor, getInitials } from "./avatar-utils";

interface Props {
  message: ContactMessageDTO;
  selected: boolean;
  onSelect: (message: ContactMessageDTO) => void;
}

const STATUS_DOT_COLOR: Record<ContactMessageDTO["status"], string> = {
  new: "var(--accent)",
  read: "var(--notice)",
  replied: "#16a34a",
};

/** One row in the mail-style list pane -- deliberately compact (avatar,
 * name, one-line message preview, timestamp) since the full content
 * lives in ContactMessageDetailPane once a row is selected. The colored
 * dot carries status at a glance without spending row width on a text
 * badge; full badges (backfilled, unconfirmed, status name) render in
 * the detail pane where there's room for them. */
export function ContactMessageListItem({ message, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`contact-mail-list-item ${selected ? "contact-mail-list-item-selected" : ""}`}
      onClick={() => onSelect(message)}
    >
      <span className="contact-mail-avatar" style={{ background: getAvatarColor(message.email) }}>
        {getInitials(message.name)}
      </span>
      <span className="contact-mail-list-item-body">
        <span className="contact-mail-list-item-row">
          <span className="contact-mail-list-item-name">
            <span className="contact-mail-status-dot" style={{ background: STATUS_DOT_COLOR[message.status] }} />
            {message.name}
          </span>
          <span className="contact-mail-list-item-time">{formatRelativeOrDate(message.createdAt)}</span>
        </span>
        <span className="contact-mail-list-item-preview">{message.message}</span>
      </span>
    </button>
  );
}
