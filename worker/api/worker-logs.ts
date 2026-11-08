import { WORKER_TARGETS, type WorkerLogSummaryDTO, type WorkerStatusCount } from "../../shared/worker-logs";
import { runCloudflareGraphQL } from "../lib/cf-graphql-client";
import { errorResponse, json } from "../lib/http";
import type { Env } from "../types";

// HONEST CAVEAT, read before debugging a permission/field error here:
// unlike httpRequests1dGroups and firewallEventsAdaptiveGroups (both
// confirmed working against this account), this specific dataset's
// exact field names were NOT verified against a live account before
// shipping -- Cloudflare's Workers-analytics GraphQL schema is less
// publicly documented than the zone-level one. If this errors, the
// message will surface verbatim in the UI same as everywhere else in
// this project -- the fastest way to fix the field names, not a sign
// the whole approach is wrong. Candidate permission(s) to try on the
// Account-scoped policy row: "Workers Observability: Read" first; if
// that's not it, "Account Analytics: Read" (already granted for the
// Analytics Engine widget) may double as the one this dataset needs.
const WORKER_INVOCATIONS_QUERY = `
  query GetWorkerInvocations($accountTag: string!, $scriptName: string!, $since: Time!, $until: Time!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        workersInvocationsAdaptiveGroups(
          limit: 1000
          filter: { datetime_geq: $since, datetime_leq: $until, scriptName: $scriptName }
        ) {
          dimensions {
            status
          }
          sum {
            requests
            errors
          }
          avg {
            cpuTime
          }
        }
      }
    }
  }
`;

interface InvocationGroup {
  dimensions: { status: string };
  sum: { requests: number; errors: number };
  avg: { cpuTime: number };
}

interface GraphQLResponse {
  viewer: { accounts: { workersInvocationsAdaptiveGroups: InvocationGroup[] }[] };
}

export async function handleWorkerLogsRequest(env: Env, key: string): Promise<Response> {
  const target = WORKER_TARGETS.find((t) => t.key === key);
  if (!target) return errorResponse("Unknown Worker.", 404);

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return errorResponse("Worker Logs is not configured yet.", 503);
  }

  const until = new Date();
  const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);

  const data = await runCloudflareGraphQL<GraphQLResponse>(env.CLOUDFLARE_API_TOKEN, WORKER_INVOCATIONS_QUERY, {
    accountTag: env.CLOUDFLARE_ACCOUNT_ID,
    scriptName: target.scriptName,
    since: since.toISOString(),
    until: until.toISOString(),
  });

  const groups = data.viewer.accounts[0]?.workersInvocationsAdaptiveGroups ?? [];

  const byStatus: WorkerStatusCount[] = groups.map((g) => ({
    status: g.dimensions.status,
    requests: g.sum.requests,
  }));

  const totalRequests = byStatus.reduce((sum, s) => sum + s.requests, 0);
  const totalErrors = groups.reduce((sum, g) => sum + g.sum.errors, 0);
  const avgCpuTimeMs = groups.length > 0 ? groups.reduce((sum, g) => sum + g.avg.cpuTime, 0) / groups.length : 0;

  const payload: WorkerLogSummaryDTO = {
    scriptName: target.scriptName,
    label: target.label,
    totalRequests,
    totalErrors,
    avgCpuTimeMs: Math.round(avgCpuTimeMs),
    byStatus,
  };

  return json(payload);
}

// --- Schema introspection, temporary diagnostic tool ---
//
// The field-name guess above (workersInvocationsAdaptiveGroups) turned
// out to be wrong: the live schema returned "unknown field" for it.
// Rather than guess a SECOND time with the same low confidence, this
// asks Cloudflare's own GraphQL schema what the real field is, via
// standard GraphQL introspection (__schema). Filters server-side to
// just type/field names containing "orker" (matches "Worker"/"worker")
// so the response stays small instead of forwarding the whole schema.
// Safe to leave deployed -- read-only, authenticated same as every
// other /api/* route, costs nothing when not called.
const INTROSPECTION_QUERY = `
  query {
    __schema {
      types {
        name
        fields { name }
      }
    }
  }
`;

interface IntrospectionField {
  name: string;
}

interface IntrospectionType {
  name: string;
  fields: IntrospectionField[] | null;
}

interface IntrospectionResponse {
  __schema: { types: IntrospectionType[] };
}

export async function handleWorkerLogsSchemaDebugRequest(env: Env): Promise<Response> {
  if (!env.CLOUDFLARE_API_TOKEN) {
    return errorResponse("Worker Logs is not configured yet.", 503);
  }

  const data = await runCloudflareGraphQL<IntrospectionResponse>(env.CLOUDFLARE_API_TOKEN, INTROSPECTION_QUERY, {});

  const matches = data.__schema.types.flatMap((t) =>
    (t.fields ?? [])
      .filter((f) => /orker/.test(f.name))
      .map((f) => ({ typeName: t.name, fieldName: f.name })),
  );

  return json(matches);
}
