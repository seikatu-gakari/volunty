import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ParticipantProfileForm } from "./components/ParticipantProfileForm";

/** 認証状態とプロフィール登録状況を取得する */
async function getPageState(): Promise<{
  isAuthenticated: boolean;
  hasProfile: boolean;
}> {
  // 1. 認証チェック
  let user;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return { isAuthenticated: false, hasProfile: false };
  }

  if (!user) {
    return { isAuthenticated: false, hasProfile: false };
  }

  // 2. プロフィールチェック（DB エラー時は未登録扱いだが認証は true を維持）
  try {
    const profile = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return { isAuthenticated: true, hasProfile: !!profile };
  } catch {
    // DB エラーでもログイン状態は維持してフォームを表示する
    return { isAuthenticated: true, hasProfile: false };
  }
}

export default async function OnboardingParticipantPage() {
  const { isAuthenticated, hasProfile } = await getPageState();

  if (!isAuthenticated) redirect("/login");
  if (hasProfile) redirect("/");

  return <ParticipantProfileForm />;
}
