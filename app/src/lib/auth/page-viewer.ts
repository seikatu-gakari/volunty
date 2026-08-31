import "server-only";

import { redirect } from "next/navigation";
import type { ViewerContext } from "./viewer-context";

type AuthenticatedViewer = Extract<ViewerContext, { status: "authenticated" }>;

function requireAuthenticatedViewer(viewer: ViewerContext): AuthenticatedViewer {
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive) redirect("/auth/signout?reason=suspended");
  return viewer;
}

/** 参加者向け表示ページの ViewerContext 認可境界。 */
export function requireParticipantViewer(
  viewer: ViewerContext
): AuthenticatedViewer {
  const authenticatedViewer = requireAuthenticatedViewer(viewer);
  if (authenticatedViewer.role !== "participant") redirect("/forbidden");
  if (!authenticatedViewer.hasParticipantProfile) redirect("/onboarding/role");
  return authenticatedViewer;
}

/** 承認済み団体向け表示ページの ViewerContext 認可境界。 */
export function requireApprovedOrganizationViewer(
  viewer: ViewerContext
): AuthenticatedViewer {
  const authenticatedViewer = requireAuthenticatedViewer(viewer);
  if (authenticatedViewer.role !== "organization") redirect("/forbidden");
  if (!authenticatedViewer.hasOrganizationProfile) {
    redirect("/onboarding/organization");
  }
  if (authenticatedViewer.organizationReviewStatus !== "approved") {
    redirect("/onboarding/pending");
  }
  return authenticatedViewer;
}
