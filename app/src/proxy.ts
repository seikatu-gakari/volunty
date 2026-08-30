import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { ViewerIdentity } from "@/lib/auth/viewer-context";
import { updateSession } from "@/lib/supabase/middleware";
import {
  getSupabaseAnonKey,
  getSupabaseServerUrl,
  SUPABASE_AUTH_COOKIE_NAME,
} from "@/lib/supabase/env";

const AUTH_CALLBACK = "/auth/callback";
const PUBLIC_PATHS = new Set(["/", "/diagnosis/trial", "/opportunities"]);
const PROTECTED_PATH_PREFIXES = [
  "/admin",
  "/dashboard",
  "/diagnosis",
  "/mypage",
  "/onboarding",
  "/opportunities",
  "/organizations",
  "/recommendations",
];

type AppRole = "participant" | "organization" | "admin";
type RecordValue = Record<string, unknown>;

const ROLE_PATH_PREFIXES: Record<AppRole, readonly string[]> = {
  participant: [
    "/diagnosis",
    "/mypage",
    "/opportunities",
    "/organizations",
    "/recommendations",
  ],
  organization: ["/dashboard"],
  admin: ["/admin"],
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAppRole(value: unknown): value is AppRole {
  return value === "participant" || value === "organization" || value === "admin";
}

function normalizeEmbeddedRecord(value: unknown): RecordValue | null {
  if (Array.isArray(value)) {
    return value.find(isRecord) ?? null;
  }
  return isRecord(value) ? value : null;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isRoleAllowed(pathname: string, role: AppRole): boolean {
  const owner = (
    Object.entries(ROLE_PATH_PREFIXES) as [AppRole, readonly string[]][]
  ).find(([, prefixes]) =>
    prefixes.some((prefix) => matchesPrefix(pathname, prefix)),
  )?.[0];
  return owner === undefined || owner === role;
}

function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/signup");
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function isOnboardingPath(pathname: string): boolean {
  return pathname.startsWith("/onboarding");
}

function redirectWithCookies(url: URL, sourceResponse: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value);
  });
  return redirectResponse;
}

function redirectTo(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return redirectWithCookies(url, response);
}

async function getAuthorizationRecord(
  request: NextRequest,
  response: NextResponse,
  identity: ViewerIdentity,
): Promise<{ account: RecordValue | null; failed: boolean }> {
  const supabaseUrl = getSupabaseServerUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    return { account: null, failed: true };
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    const { data, error } = await supabase
      .from("m_user")
      .select(
        "is_active,role,m_participant_profile(id),m_organization_profile(id,verified,review_status)",
      )
      .eq("id", identity.id)
      .maybeSingle();

    if (error) {
      console.error("[proxy] m_user lookup failed", {
        code: "m_user_lookup_error",
      });
      return { account: null, failed: true };
    }

    return { account: isRecord(data) ? data : null, failed: false };
  } catch {
    console.error("[proxy] m_user lookup failed", {
      code: "m_user_lookup_error",
    });
    return { account: null, failed: true };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith(AUTH_CALLBACK)) {
    return NextResponse.next({ request });
  }

  const { response, identity } = await updateSession(request);

  if (isAuthPath(pathname)) {
    return identity ? redirectTo(request, response, "/") : response;
  }

  if (PUBLIC_PATHS.has(pathname) || !isProtectedPath(pathname)) {
    return response;
  }

  if (!identity) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectWithCookies(url, response);
  }

  const { account, failed } = await getAuthorizationRecord(
    request,
    response,
    identity,
  );
  if (failed) {
    return redirectTo(request, response, "/forbidden");
  }

  if (account?.is_active === false) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signout";
    url.search = "";
    url.searchParams.set("reason", "suspended");
    return redirectWithCookies(url, response);
  }

  const role = account?.role;
  if (!account) {
    console.error("[proxy] m_user role missing", { code: "m_user_role_missing" });
  } else if (!isAppRole(role)) {
    console.error("[proxy] m_user role invalid", { code: "m_user_role_invalid" });
  }

  if (isOnboardingPath(pathname)) {
    return response;
  }

  if (!account || !isAppRole(role)) {
    return redirectTo(request, response, "/forbidden");
  }

  const participantProfile = normalizeEmbeddedRecord(account.m_participant_profile);
  const organizationProfile = normalizeEmbeddedRecord(account.m_organization_profile);
  const hasRequiredProfile =
    role === "admin" ||
    (role === "participant" && participantProfile !== null) ||
    (role === "organization" && organizationProfile !== null);
  if (!hasRequiredProfile) {
    return redirectTo(request, response, "/onboarding/role");
  }

  if (!isRoleAllowed(pathname, role)) {
    return redirectTo(request, response, "/forbidden");
  }

  if (
    role === "organization" &&
    pathname !== "/onboarding/pending" &&
    organizationProfile?.review_status !== "approved"
  ) {
    return redirectTo(request, response, "/onboarding/pending");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
