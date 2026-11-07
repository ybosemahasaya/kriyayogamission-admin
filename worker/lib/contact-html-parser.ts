/**
 * Reconstructs the original contact-form fields from the HTML body of the
 * notification email -- used only by the one-time backfill (see
 * worker/api/contact-messages.ts) to recover submissions that happened
 * before contact_messages existed. This is deliberately coupled to the
 * EXACT template string literal in the public site's worker.js
 * (handleContactForm's `html` variable) -- if that template ever changes,
 * this parser needs updating alongside it, or old backfill runs will
 * start silently skipping everything. Current template shape:
 *
 *   <h2>New contact form submission</h2>
 *   <p><strong>Name:</strong> ...</p>
 *   <p><strong>Email:</strong> ...</p>
 *   <p><strong>Phone:</strong> ... (or &mdash; if empty)</p>
 *   <p><strong>Address:</strong> ... (or &mdash; if empty)</p>
 *   <p><strong>Message:</strong></p>
 *   <p>...multi-line, \n converted to <br>...</p>
 */

export interface ParsedContactNotification {
  name: string;
  email: string;
  phone: string;
  address: string;
  message: string;
}

/** Reverses worker.js's escapeHtml() -- order matters, &amp; must be last
 * or a literal "&lt;" in the original text would double-decode. */
function unescapeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractSingleLineField(html: string, label: string): string | null {
  const match = html.match(new RegExp(`<strong>${label}:</strong>\\s*([^<]*)</p>`, "i"));
  return match ? match[1].trim() : null;
}

/** Phone/Address render as the literal entity "&mdash;" when the original
 * field was empty (see worker.js: `escapeHtml(phone) || "&mdash;"`). */
function normalizeOptionalField(value: string | null): string {
  if (!value || value === "&mdash;") return "";
  return unescapeHtml(value);
}

function extractMessage(html: string): string | null {
  const match = html.match(/<strong>Message:<\/strong><\/p>\s*<p>([\s\S]*?)<\/p>/i);
  if (!match) return null;
  return unescapeHtml(match[1].replace(/<br\s*\/?>/gi, "\n")).trim();
}

/** Returns null (rather than a partially-filled object) if any required
 * field is missing -- a half-parsed row is worse than no row at all, and
 * the caller treats null as "skip this one" rather than inserting
 * garbage into contact_messages. */
export function parseContactNotificationHtml(html: string): ParsedContactNotification | null {
  const rawName = extractSingleLineField(html, "Name");
  const rawEmail = extractSingleLineField(html, "Email");
  const message = extractMessage(html);
  if (!rawName || !rawEmail || !message) return null;

  return {
    name: unescapeHtml(rawName),
    email: unescapeHtml(rawEmail),
    phone: normalizeOptionalField(extractSingleLineField(html, "Phone")),
    address: normalizeOptionalField(extractSingleLineField(html, "Address")),
    message,
  };
}
