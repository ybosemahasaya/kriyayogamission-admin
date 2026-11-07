/**
 * Thin wrapper around Cloudflare's GraphQL Analytics API
 * (https://api.cloudflare.com/client/v4/graphql). Same "thin client,
 * shaping happens in the api/ handler" split as worker/lib/ga4-client.ts
 * -- this file only knows how to send a query and surface Cloudflare's
 * own error text; it has no idea what a "zone" or "firewall event" means.
 */

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

interface GraphQLError {
  message: string;
}

interface GraphQLEnvelope<T> {
  data?: T;
  errors?: GraphQLError[];
}

export async function runCloudflareGraphQL<T>(
  apiToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudflare GraphQL API request failed: ${res.status} ${text}`);
  }

  const body = (await res.json()) as GraphQLEnvelope<T>;

  // Cloudflare's GraphQL endpoint returns 200 OK even when the query
  // itself failed (bad field name, missing permission, unknown zone) --
  // the real error lives in the `errors` array, not the HTTP status.
  // Surfacing it verbatim matters here: dataset/field availability can
  // vary slightly by Cloudflare plan, so the exact message is the
  // fastest way to tell "wrong token scope" apart from "this field
  // doesn't exist on this schema version."
  if (body.errors?.length) {
    throw new Error(`Cloudflare GraphQL API error: ${body.errors.map((e) => e.message).join("; ")}`);
  }

  if (!body.data) {
    throw new Error("Cloudflare GraphQL API returned no data");
  }

  return body.data;
}
