import type { ContactMessageDTO } from "../../../shared/contact-messages";

export interface MessageGroup {
  label: string;
  items: ContactMessageDTO[];
}

/** Buckets an already-date-sorted (DESC) list into Today/Yesterday/Earlier
 * sections, mirroring the mail-client list pattern this UI is modeled on.
 * Input order is preserved within each bucket since the API already
 * returns messages sorted by created_at DESC. */
export function groupByRecency(messages: ContactMessageDTO[]): MessageGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

  const today: ContactMessageDTO[] = [];
  const yesterday: ContactMessageDTO[] = [];
  const earlier: ContactMessageDTO[] = [];

  for (const message of messages) {
    const createdAt = new Date(message.createdAt);
    if (createdAt >= startOfToday) today.push(message);
    else if (createdAt >= startOfYesterday) yesterday.push(message);
    else earlier.push(message);
  }

  const groups: MessageGroup[] = [];
  if (today.length > 0) groups.push({ label: "Today", items: today });
  if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });
  if (earlier.length > 0) groups.push({ label: "Earlier", items: earlier });
  return groups;
}
