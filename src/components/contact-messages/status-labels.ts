import type { ContactMessageStatus } from "../../../shared/contact-messages";

export const STATUS_LABELS: Record<ContactMessageStatus, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
};

export const STATUS_ORDER: ContactMessageStatus[] = ["new", "read", "replied"];
