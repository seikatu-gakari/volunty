import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { ParticipantProfileForm } from "@/app/onboarding/participant/components/ParticipantProfileForm";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { fetchParticipantProfileByUserId } from "@/lib/participant-profile/server";

export default async function EditProfilePage() {
  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive || viewer.role !== "participant") {
    redirect("/forbidden");
  }

  const profile = await fetchParticipantProfileByUserId(viewer.identity.id);

  if (!profile) {
    // プロフィールが存在しない場合はオンボーディングへ飛ばす
    redirect("/onboarding/participant");
  }

  const bYear = profile.birthday.getUTCFullYear().toString();
  const bMonth = (profile.birthday.getUTCMonth() + 1).toString();
  const bDay = profile.birthday.getUTCDate().toString();

  const defaultValues = {
    name: profile.name,
    birthYear: bYear,
    birthMonth: bMonth,
    birthDay: bDay,
    gender: profile.gender || "",
    region: profile.region,
    bio: profile.bio || "",
    lineId: profile.lineId || "",
    interests: profile.interests,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <Header viewerContext={viewer} />
      <ParticipantProfileForm
        isEdit={true}
        defaultValues={defaultValues}
        onSuccessRedirect="/mypage"
      />
    </div>
  );
}
