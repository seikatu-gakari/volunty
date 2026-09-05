import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  parseForwardedViewerContext,
  type ViewerIdentity,
  type ViewerRole,
  VIEWER_CONTEXT_HEADER,
} from "@/lib/auth/viewer-context-header";

export type { ViewerIdentity, ViewerRole } from "@/lib/auth/viewer-context-header";

export type ViewerContext =
  | { status: "guest" }
  | {
      status: "authenticated";
      identity: ViewerIdentity;
      role: ViewerRole | null;
      isActive: boolean;
      hasParticipantProfile: boolean;
      hasOrganizationProfile: boolean;
      organizationVerified: boolean;
      organizationReviewStatus: string | null;
    }
  | {
      status: "error";
      identity?: ViewerIdentity;
      errorCode:
        | "claims_invalid"
        | "auth_unavailable"
        | "account_lookup_failed";
    };

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asViewerRole(value: unknown): ViewerRole | null {
  return value === "participant" || value === "organization" || value === "admin"
    ? value
    : null;
}

function normalizeEmbeddedRecord(value: unknown): RecordValue | null {
  if (Array.isArray(value)) {
    return value.find(isRecord) ?? null;
  }

  return isRecord(value) ? value : null;
}

function identityFromClaims(claims: unknown): ViewerIdentity | null {
  if (!isRecord(claims)) {
    return null;
  }

  const id = asNonEmptyString(claims.sub);
  if (!id) {
    return null;
  }

  const metadata = isRecord(claims.user_metadata) ? claims.user_metadata : {};
  return {
    id,
    email: asNonEmptyString(claims.email),
    displayName: asNonEmptyString(metadata.full_name),
  };
}

export const getViewerContext = cache(async (): Promise<ViewerContext> => {
  const forwardedViewer = parseForwardedViewerContext(
    (await headers()).get(VIEWER_CONTEXT_HEADER),
  );
  if (forwardedViewer) {
    return { status: "authenticated", ...forwardedViewer };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", errorCode: "auth_unavailable" };
  }

  const claimsResult = await supabase.auth.getClaims().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!claimsResult) {
    return { status: "error", errorCode: "auth_unavailable" };
  }
  const { data: claimsData, error: claimsError } = claimsResult;
  if (claimsError) {
    return { status: "error", errorCode: "claims_invalid" };
  }

  if (!claimsData?.claims) {
    return { status: "guest" };
  }

  const identity = identityFromClaims(claimsData.claims);
  if (!identity) {
    return { status: "error", errorCode: "claims_invalid" };
  }

  const { data, error } = await supabase
    .from("m_user")
    .select(
      "is_active,role,m_participant_profile(id),m_organization_profile(id,verified,review_status)",
    )
    .eq("id", identity.id)
    .maybeSingle();

  if (error) {
    return {
      status: "error",
      identity,
      errorCode: "account_lookup_failed",
    };
  }

  const account = isRecord(data) ? data : null;
  const participantProfile = normalizeEmbeddedRecord(
    account?.m_participant_profile,
  );
  const organizationProfile = normalizeEmbeddedRecord(
    account?.m_organization_profile,
  );

  return {
    status: "authenticated",
    identity,
    role: asViewerRole(account?.role),
    isActive: account?.is_active === true,
    hasParticipantProfile: participantProfile !== null,
    hasOrganizationProfile: organizationProfile !== null,
    organizationVerified: organizationProfile?.verified === true,
    organizationReviewStatus: asNonEmptyString(
      organizationProfile?.review_status,
    ),
  };
});
