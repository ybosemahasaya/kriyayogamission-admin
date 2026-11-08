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
// Confirmed-real top-level field via a first round of this same tool:
// workersInvocationsByOwnerAndScriptGroups (groups by script, exactly
// what's needed to tell the three Workers apart). This second mode
// drills into that field's return type and every related nested type
// (Dimensions/Sum/Avg/Quantiles/Uniq, following Cloudflare's own naming
// convention -- confirmed by AccountWorkersInvocationsByOwnerAndScript
// GroupsUniq showing up in the first round) so the real query can be
// written against the real shape instead of guessing a third time.
// Safe to leave deployed permanently -- read-only, authenticated same
// as every other /api/* route, costs nothing when not called.
const INTROSPECTION_QUERY = `
  query {
    __schema {
      types {
        name
        fields {
          name
          type {
            kind
            name
            ofType { kind name ofType { kind name } }
          }
        }
        inputFields {
          name
          type {
            kind
            name
            ofType { kind name ofType { kind name } }
          }
        }
      }
    }
  }
`;

interface IntrospectionTypeRef {
  kind: string;
  name: string | null;
  ofType: { kind: string; name: string | null; ofType: { kind: string; name: string | null } | null } | null;
}

interface IntrospectionField {
  name: string;
  type: IntrospectionTypeRef;
}

interface IntrospectionType {
  name: string;
  fields: IntrospectionField[] | null;
  inputFields: IntrospectionField[] | null;
}

interface IntrospectionResponse {
  __schema: { types: IntrospectionType[] };
}

function unwrapTypeName(ref: IntrospectionTypeRef): string {
  return ref.name ?? ref.ofType?.name ?? ref.ofType?.ofType?.name ?? ref.kind;
}

export async function handleWorkerLogsSchemaDebugRequest(env: Env, pattern: string): Promise<Response> {
  if (!env.CLOUDFLARE_API_TOKEN) {
    return errorResponse("Worker Logs is not configured yet.", 503);
  }

  const data = await runCloudflareGraphQL<IntrospectionResponse>(env.CLOUDFLARE_API_TOKEN, INTROSPECTION_QUERY, {});
  const needle = new RegExp(pattern, "i");

  // Default mode (no ?type= param): field names on ANY type matching
  // the pattern -- good for an initial "does this field exist" sweep.
  // With ?type=: full field list (name + resolved type) of every TYPE
  // whose own name matches -- good for learning one dataset's exact
  // shape once you already know its top-level field name.
  const byType = data.__schema.types
    .filter((t) => needle.test(t.name))
    .map((t) => ({
      typeName: t.name,
      fields: (t.fields ?? []).map((f) => ({ fieldName: f.name, type: unwrapTypeName(f.type) })),
      inputFields: (t.inputFields ?? []).map((f) => ({ fieldName: f.name, type: unwrapTypeName(f.type) })),
    }));

  const byField = data.__schema.types.flatMap((t) =>
    (t.fields ?? [])
      .filter((f) => needle.test(f.name))
      .map((f) => ({ typeName: t.name, fieldName: f.name, type: unwrapTypeName(f.type) })),
  );

  return json({ byType, byField });
}
