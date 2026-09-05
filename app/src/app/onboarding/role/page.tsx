import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { RoleSelectionClient } from "./RoleSelectionClient";

export default async function OnboardingRolePage() {
  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive) {
    redirect("/auth/signout?reason=suspended");
  }

  if (viewer.role === "admin") {
    redirect("/");
  }

  if (!viewer.role) {
    return <RoleSelectionClient />;
  }

  if (
    (viewer.role === "participant" && viewer.hasParticipantProfile) ||
    (viewer.role === "organization" && viewer.hasOrganizationProfile)
  ) {
    redirect("/");
  }

  return <RoleSelectionClient />;
}
