import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/components/Header";
import { ParticipantProfileForm } from "@/app/onboarding/participant/components/ParticipantProfileForm";
import { fetchParticipantProfileByUserId } from "@/lib/participant-profile/server";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await fetchParticipantProfileByUserId(user.id);

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
      <Header />
      <ParticipantProfileForm
        isEdit={true}
        defaultValues={defaultValues}
        onSuccessRedirect="/mypage"
      />
    </div>
  );
}
