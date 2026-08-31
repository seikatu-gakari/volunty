import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { ParticipantProfileForm } from "./components/ParticipantProfileForm";

export default async function OnboardingParticipantPage() {
  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive) {
    redirect("/auth/signout?reason=suspended");
  }
  if (viewer.role === null) redirect("/onboarding/role");
  if (viewer.role === "organization") redirect("/onboarding/organization");
  if (viewer.role !== "participant") redirect("/");
  if (viewer.hasParticipantProfile) redirect("/");

  return <ParticipantProfileForm />;
}
