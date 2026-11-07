import type { ContactDirectoryEntry } from "../../../shared/contacts";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Deduplicated "who has contacted us" view -- Name/Email/Phone/Address
 * only, deliberately no message content (see shared/contacts.ts). This
 * is a read-only directory computed fresh from contact_messages, not a
 * separate table, so it is always in sync by construction. */
export function ContactDirectoryTable({ contacts }: { contacts: ContactDirectoryEntry[] }) {
  if (contacts.length === 0) {
    return <p className="empty-state">No contacts yet.</p>;
  }

  return (
    <div className="contact-directory-table-wrap">
      <table className="contact-directory-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Address</th>
            <th>Messages</th>
            <th>First contacted</th>
            <th>Last contacted</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.email}>
              <td>{contact.name}</td>
              <td>{contact.email}</td>
              <td>{contact.phone || "\u2014"}</td>
              <td>{contact.address || "\u2014"}</td>
              <td>{contact.messageCount}</td>
              <td>{formatDate(contact.firstContactedAt)}</td>
              <td>{formatDate(contact.lastContactedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
