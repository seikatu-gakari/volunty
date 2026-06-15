import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  resolveOnboardingRole,
  type OnboardingRole,
} from "@/lib/onboarding/role";
import { ParticipantProfileForm } from "./components/ParticipantProfileForm";
import { fetchParticipantProfileByUserId } from "@/lib/participant-profile/server";

/** 認証状態・ロール・プロフィール登録状況を取得する */
async function getPageState(): Promise<{
  isAuthenticated: boolean;
  role: OnboardingRole | null;
  hasProfile: boolean;
}> {
  // 1. 認証チェック
  let user;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return { isAuthenticated: false, role: null, hasProfile: false };
  }

  if (!user) {
    return { isAuthenticated: false, role: null, hasProfile: false };
  }

  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  let dbRole: unknown = null;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    dbRole = dbUser?.role;
  } catch (err) {
    // DB エラー時は既存の Auth metadata にフォールバックする
    console.error("[OnboardingParticipantPage] ロール確認に失敗:", err);
  }

  const role = resolveOnboardingRole({
    dbRole,
    metadataRole: metadata?.role,
  });

  if (role !== "participant") {
    return { isAuthenticated: true, role, hasProfile: false };
  }

  // 2. プロフィールチェック（DB エラー時は未登録扱いだが認証は true を維持）
  try {
    const profile = await fetchParticipantProfileByUserId(user.id);
    return { isAuthenticated: true, role, hasProfile: !!profile };
  } catch (err) {
    // DB エラーでもログイン状態は維持してフォームを表示する
    console.error("[OnboardingParticipantPage] プロフィール確認に失敗:", err);
    return { isAuthenticated: true, role, hasProfile: false };
  }
}

export default async function OnboardingParticipantPage() {
  const { isAuthenticated, role, hasProfile } = await getPageState();

  if (!isAuthenticated) redirect("/login");
  if (role === null) redirect("/onboarding/role");
  if (role === "organization") redirect("/onboarding/organization");
  if (role !== "participant") redirect("/");
  if (hasProfile) redirect("/");

  return <ParticipantProfileForm />;
}
