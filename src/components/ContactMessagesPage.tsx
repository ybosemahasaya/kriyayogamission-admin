import { useCallback, useEffect, useState } from "react";
import {
  backfillContactMessagesFromResend,
  deleteContactMessage,
  getEmailMetrics,
  listContactMessages,
  updateContactMessageStatus,
} from "../api/contact-messages";
import type { ContactMessageDTO, ContactMessageStatus, ContactMessageStatusCounts } from "../../shared/contact-messages";
import type { EmailMetricsDTO } from "../../shared/email-metrics";
import { ContactMessageCard } from "./contact-messages/ContactMessageCard";
import { EmailMetricsCard } from "./contact-messages/EmailMetricsCard";
import { STATUS_LABELS, STATUS_ORDER } from "./contact-messages/status-labels";

type TabFilter = ContactMessageStatus | "all";

const EMPTY_COUNTS: ContactMessageStatusCounts = { new: 0, read: 0, replied: 0 };

/** Closes the gap described in docs/admin-panel-architecture.html's
 * "contact-form-log" roadmap item: the public site's /api/contact route
 * used to only send an email via Resend, so a bounce/outage/spam-filter
 * meant the inquiry vanished with zero record anywhere. Every submission
 * now lands here regardless of what happens to its notification email --
 * see shared/contact-messages.ts and migrations/0004. */
export function ContactMessagesPage() {
  const [tab, setTab] = useState<TabFilter>("all");
  const [messages, setMessages] = useState<ContactMessageDTO[]>([]);
  const [counts, setCounts] = useState<ContactMessageStatusCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<EmailMetricsDTO | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    listContactMessages(tab)
      .then((res) => {
        setMessages(res.messages);
        setCounts(res.counts);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load contact messages."))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      setBackfillMessage(
        `Imported ${result.imported} new message${result.imported === 1 ? "" : "s"}` +
          ` (${result.alreadyPresent} already present, ${result.skipped} skipped).`,
      );
      refresh();
    } catch (err) {
      setBackfillMessage(err instanceof Error ? err.message : "Backfill failed.");
    } finally {
      setBackfillRunning(false);
    }
  }

  const totalCount = counts.new + counts.read + counts.replied;

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
      </div>

      {loading && <p className="empty-state">Loading...</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && messages.length === 0 && (
        <p className="empty-state">
          No contact messages{tab !== "all" ? ` with status "${STATUS_LABELS[tab as ContactMessageStatus]}"` : ""} yet.
        </p>
      )}

      {!loading && !error && messages.length > 0 && (
        <div className="contact-messages-list">
          {messages.map((message) => (
            <ContactMessageCard
              key={message.id}
              message={message}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
