export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

/**
 * Cloudflare Access puts the authenticated user's email in this header on
 * every request that reaches the Worker, once an Access Application is
 * configured in front of this domain. We don't re-implement login/session
 * logic here -- Access already rejected anyone not on the allowlist before
 * the request got this far. This is just for audit/display purposes
 * (e.g. "uploaded by ___").
 */
export function getAccessUserEmail(request: Request): string | null {
  return request.headers.get("Cf-Access-Authenticated-User-Email");
}
