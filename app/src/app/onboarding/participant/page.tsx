import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ParticipantProfileForm } from "./components/ParticipantProfileForm";

/** 認証状態とプロフィール登録状況を取得する */
async function getPageState(): Promise<{
  isAuthenticated: boolean;
  hasProfile: boolean;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { isAuthenticated: false, hasProfile: false };
    }

    const profile = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    return { isAuthenticated: true, hasProfile: !!profile };
  } catch {
    // Supabase / Prisma 未設定時はスキップ
    return { isAuthenticated: false, hasProfile: false };
  }
}

export default async function OnboardingParticipantPage() {
  const { isAuthenticated, hasProfile } = await getPageState();

  if (!isAuthenticated) redirect("/login");
  if (hasProfile) redirect("/");

  return <ParticipantProfileForm />;
}
