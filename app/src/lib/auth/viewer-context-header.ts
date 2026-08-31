export const VIEWER_CONTEXT_HEADER = "x-volunty-viewer-context";

const VIEWER_CONTEXT_HEADER_VERSION = 1;

export type ViewerRole = "participant" | "organization" | "admin";

export interface ViewerIdentity {
  id: string;
  email: string | null;
  displayName: string | null;
}

export interface ForwardedViewerContext {
  identity: ViewerIdentity;
  role: ViewerRole;
  isActive: boolean;
  hasParticipantProfile: boolean;
  hasOrganizationProfile: boolean;
  organizationVerified: boolean;
  organizationReviewStatus: string | null;
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isViewerRole(value: unknown): value is ViewerRole {
  return value === "participant" || value === "organization" || value === "admin";
}

export function serializeForwardedViewerContext(
  viewer: ForwardedViewerContext,
): string {
  return encodeURIComponent(
    JSON.stringify({ version: VIEWER_CONTEXT_HEADER_VERSION, ...viewer }),
  );
}

export function parseForwardedViewerContext(
  value: string | null,
): ForwardedViewerContext | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!isRecord(parsed) || parsed.version !== VIEWER_CONTEXT_HEADER_VERSION) {
      return null;
    }

    const identity = parsed.identity;
    if (
      !isRecord(identity) ||
      typeof identity.id !== "string" ||
      identity.id.trim().length === 0 ||
      !isNullableString(identity.email) ||
      !isNullableString(identity.displayName) ||
      !isViewerRole(parsed.role) ||
      typeof parsed.isActive !== "boolean" ||
      typeof parsed.hasParticipantProfile !== "boolean" ||
      typeof parsed.hasOrganizationProfile !== "boolean" ||
      typeof parsed.organizationVerified !== "boolean" ||
      !isNullableString(parsed.organizationReviewStatus)
    ) {
      return null;
    }

    return {
      identity: {
        id: identity.id,
        email: identity.email,
        displayName: identity.displayName,
      },
      role: parsed.role,
      isActive: parsed.isActive,
      hasParticipantProfile: parsed.hasParticipantProfile,
      hasOrganizationProfile: parsed.hasOrganizationProfile,
      organizationVerified: parsed.organizationVerified,
      organizationReviewStatus: parsed.organizationReviewStatus,
    };
  } catch {
    return null;
  }
}
