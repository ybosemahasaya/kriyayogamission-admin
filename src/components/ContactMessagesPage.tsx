import { useCallback, useEffect, useState } from "react";
import {
  backfillContactMessagesFromResend,
  deleteContactMessage,
  getEmailMetrics,
  listContactMessages,
  updateContactMessageStatus,
} from "../api/contact-messages";
import { listContactDirectory } from "../api/contacts";
import type { ContactMessageDTO, ContactMessageStatus, ContactMessageStatusCounts } from "../../shared/contact-messages";
import type { ContactDirectoryEntry } from "../../shared/contacts";
import type { EmailMetricsDTO } from "../../shared/email-metrics";
import { ContactDirectoryTable } from "./contact-messages/ContactDirectoryTable";
import { ContactMessageDetailPane } from "./contact-messages/ContactMessageDetailPane";
import { ContactMessageListItem } from "./contact-messages/ContactMessageListItem";
import { EmailMetricsCard } from "./contact-messages/EmailMetricsCard";
import { groupByRecency } from "./contact-messages/group-by-recency";
import { STATUS_LABELS, STATUS_ORDER } from "./contact-messages/status-labels";

type TabFilter = ContactMessageStatus | "all" | "contacts";

const EMPTY_COUNTS: ContactMessageStatusCounts = { new: 0, read: 0, replied: 0 };

/** Closes the gap described in docs/admin-panel-architecture.html's
 * "contact-form-log" roadmap item: the public site's /api/contact route
 * used to only send an email via Resend, so a bounce/outage/spam-filter
 * meant the inquiry vanished with zero record anywhere. Every submission
 * now lands here regardless of what happens to its notification email --
 * see shared/contact-messages.ts and migrations/0004.
 *
 * UI is a mail-client-style master/detail split (list pane + reading
 * pane) rather than a single column of expandable cards -- see
 * ContactMessageListItem/ContactMessageDetailPane. */
export function ContactMessagesPage() {
  const [tab, setTab] = useState<TabFilter>("all");
  const [messages, setMessages] = useState<ContactMessageDTO[]>([]);
  const [counts, setCounts] = useState<ContactMessageStatusCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<EmailMetricsDTO | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const [contacts, setContacts] = useState<ContactDirectoryEntry[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (tab === "contacts") return; // handled by the contacts effect below
    setLoading(true);
    setError(null);
    listContactMessages(tab)
      .then((res) => {
        setMessages(res.messages);
        setCounts(res.counts);
        // Keep the current selection if it's still in the refreshed list
        // (e.g. after a status change); otherwise default to the first
        // message, same reasoning a real mail client uses so the reading
        // pane is never left pointing at a message that just vanished
        // from the current tab's filter.
        setSelectedId((prevId) => {
          if (prevId && res.messages.some((m) => m.id === prevId)) return prevId;
          return res.messages[0]?.id ?? null;
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load contact messages."))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Contacts tab is a totally different query (deduplicated by email, no
  // status/message data) -- loaded once on mount, same as email metrics,
  // so the tab's own count badge is accurate even before it's clicked.
  useEffect(() => {
    setContactsLoading(true);
    listContactDirectory()
      .then((res) => setContacts(res.contacts))
      .catch((err) => setContactsError(err instanceof Error ? err.message : "Failed to load contacts."))
      .finally(() => setContactsLoading(false));
  }, []);

  // Independent of the message list/tab selection -- Resend's send
  // history doesn't change based on which status tab is active.
  useEffect(() => {
    getEmailMetrics()
      .then(setMetrics)
      .catch((err) => setMetricsError(err instanceof Error ? err.message : "Failed to load email metrics."));
  }, []);

  async function handleStatusChange(message: ContactMessageDTO, status: ContactMessageStatus) {
    await updateContactMessageStatus(message.id, status);
    // Re-fetch rather than hand-patch local state -- status counts and
    // (if the current tab is a specific status) list membership both
    // need to update together, and a full refresh is simpler and cheap
    // at this data volume than reconciling both by hand.
    refresh();
  }

  async function handleDelete(message: ContactMessageDTO) {
    if (!window.confirm(`Delete the message from ${message.name}? This cannot be undone.`)) return;
    await deleteContactMessage(message.id);
    refresh();
  }

  // One-time (but safely re-runnable) recovery for submissions that
  // happened before this feature existed -- reconstructs them from
  // Resend's own send history. See worker/api/contact-messages.ts's
  // backfill handler for how it avoids duplicating already-imported rows.
  async function handleBackfill() {
    if (
      !window.confirm(
        "Import historical contact-form submissions from Resend's send history? " +
          "Already-imported messages are skipped automatically, so this is safe to run more than once.",
      )
    ) {
      return;
    }
    setBackfillRunning(true);
    setBackfillMessage(null);
    try {
      const result = await backfillContactMessagesFromResend();
      let message =
        `Imported ${result.imported} new message${result.imported === 1 ? "" : "s"}` +
        ` (${result.alreadyPresent} already present, ${result.skipped} skipped).` +
        ` Resend has ${result.totalEmailsInResendAccount} emails total` +
        ` (${result.excludedBySubject} didn't match the contact-form subject).`;
      if (result.nonMatchingSubjectSamples.length > 0) {
        message += ` Non-matching subjects seen: ${result.nonMatchingSubjectSamples.join("; ")}`;
      }
      setBackfillMessage(message);
      refresh();
    } catch (err) {
      setBackfillMessage(err instanceof Error ? err.message : "Backfill failed.");
    } finally {
      setBackfillRunning(false);
    }
  }

  const totalCount = counts.new + counts.read + counts.replied;
  const groups = groupByRecency(messages);
  const selectedMessage = messages.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="analytics-page">
      {metricsError && <p className="form-error">{metricsError}</p>}
      {metrics && <EmailMetricsCard metrics={metrics} />}

      <div className="contact-backfill-row">
        <button type="button" className="btn-secondary" onClick={handleBackfill} disabled={backfillRunning}>
          {backfillRunning ? "Importing..." : "Import historical messages from Resend"}
        </button>
        {backfillMessage && <span className="contact-backfill-result">{backfillMessage}</span>}
      </div>

      <div className="tabs">
        <button type="button" className={tab === "all" ? "tab active" : "tab"} onClick={() => setTab("all")}>
          All <span className="tab-count">{totalCount}</span>
        </button>
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            className={tab === status ? "tab active" : "tab"}
            onClick={() => setTab(status)}
          >
            {STATUS_LABELS[status]} <span className="tab-count">{counts[status]}</span>
          </button>
        ))}
        <button
          type="button"
          className={tab === "contacts" ? "tab active" : "tab"}
          onClick={() => setTab("contacts")}
        >
          Contacts <span className="tab-count">{contacts.length}</span>
        </button>
      </div>

      {tab === "contacts" ? (
        <>
          {contactsLoading && <p className="empty-state">Loading...</p>}
          {contactsError && <p className="form-error">{contactsError}</p>}
          {!contactsLoading && !contactsError && <ContactDirectoryTable contacts={contacts} />}
        </>
      ) : (
        <>
          {loading && <p className="empty-state">Loading...</p>}
          {error && <p className="form-error">{error}</p>}
          {!loading && !error && messages.length === 0 && (
            <p className="empty-state">
              No contact messages{tab !== "all" ? ` with status "${STATUS_LABELS[tab as ContactMessageStatus]}"` : ""} yet.
            </p>
          )}

          {!loading && !error && messages.length > 0 && (
            <div className={`contact-mail-layout ${selectedMessage ? "contact-mail-has-selection" : ""}`}>
              <div className="contact-mail-list-pane">
                {groups.map((group) => (
                  <div key={group.label} className="contact-mail-group">
                    <div className="contact-mail-group-label">{group.label}</div>
                    {group.items.map((message) => (
                      <ContactMessageListItem
                        key={message.id}
                        message={message}
                        selected={message.id === selectedId}
                        onSelect={(m) => setSelectedId(m.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className="contact-mail-detail-pane">
                {selectedMessage ? (
                  <ContactMessageDetailPane
                    message={selectedMessage}
                    onBack={() => setSelectedId(null)}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ) : (
                  <p className="empty-state">Select a message to read it.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
