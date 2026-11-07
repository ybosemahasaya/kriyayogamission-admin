/**
 * A deduplicated "who has contacted us" directory, derived entirely from
 * contact_messages (see worker/api/contacts.ts) rather than a separately
 * maintained table -- there is no write path for this data, it is always
 * computed fresh from the same rows the Contact Messages tabs already
 * show, so it can never drift out of sync. Deliberately excludes the
 * message body itself (per explicit request) -- this is a contact
 * directory, not a message archive.
 */
export interface ContactDirectoryEntry {
  email: string;
  /** Name/phone/address as of their most recent submission -- if someone
   * has submitted more than once with different details, the latest
   * wins (same reasoning you'd want for an up-to-date mailing list). */
  name: string;
  phone: string;
  address: string;
  messageCount: number;
  firstContactedAt: string;
  lastContactedAt: string;
}

export interface ContactDirectoryResponse {
  contacts: ContactDirectoryEntry[];
}
