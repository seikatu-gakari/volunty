import Link from "next/link";
import { ArrowLeft, MessageSquarePlus, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchApproachSendData } from "@/lib/approaches/actions";
import { ApproachForm } from "./ApproachForm";

export const dynamic = "force-dynamic";

export default async function NewApproachPage({
  params,
}: {
  params: Promise<{ participantId: string }>;
}) {
  const { participantId } = await params;
  const { participant, opportunities, error } =
    await fetchApproachSendData(participantId);

  if (error === "ログインが必要です") {
    redirect("/login");
  }
  if (error === "団体プロフィールが見つかりません") {
    redirect("/onboarding/organization");
  }
  if (error === "承認済み団体のみ利用できます") {
    redirect("/onboarding/pending");
  }
  if (!participant) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href={`/dashboard/participants/${participant.id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          参加者詳細に戻る
        </Link>

        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <UserRound className="size-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-dark">
                  {participant.name}さんへアプローチ
                </h1>
                <p className="mt-1 text-sm text-text-body">
                  {participant.preferredLocation ?? participant.region}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="size-5 text-primary" />
              <h2 className="text-lg font-bold text-text-dark">
                送信内容
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <ApproachForm
              participantProfileId={participant.id}
              opportunities={opportunities}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
