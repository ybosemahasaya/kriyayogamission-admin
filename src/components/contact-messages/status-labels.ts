import type { ContactMessageStatus } from "../../../shared/contact-messages";

export const STATUS_LABELS: Record<ContactMessageStatus, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
  spam_turnstile: "Spam (Turnstile)",
  spam_akismet: "Spam (Akismet)",
};

// The main triage tab row -- "All" is built from exactly these three.
export const STATUS_ORDER: ContactMessageStatus[] = ["new", "read", "replied"];

// A separate, visually-grouped set of tabs for the two spam sources,
// rendered after "Contacts" in ContactMessagesPage.tsx. Kept as a
// distinct array (not folded into STATUS_ORDER) specifically so "All"
// and its tab count never include spam -- same reasoning as
// shared/contact-messages.ts's TRIAGE_STATUSES vs SPAM_STATUSES split.
export const SPAM_STATUS_ORDER: ContactMessageStatus[] = ["spam_turnstile", "spam_akismet"];

// Every status, for the one place that genuinely needs all five: the
// detail pane's status-change dropdown, so an admin can both manually
// flag a message as spam AND recover a false positive back to "new" --
// the same dropdown already used for new/read/replied, no separate
// recovery flow needed.
export const ALL_STATUS_ORDER: ContactMessageStatus[] = [...STATUS_ORDER, ...SPAM_STATUS_ORDER];
