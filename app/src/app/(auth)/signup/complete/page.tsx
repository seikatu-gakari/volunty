import Link from "next/link";
import { Mail } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/Card";
import { ProgressBar } from "@/app/components/ui/ProgressBar";

export default function SignupCompletePage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[640px]">
        <CardContent>
          <div className="flex flex-col items-center gap-6 py-4">
            <ProgressBar value={100} />
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="size-8 text-primary" />
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-text-dark">
                確認メールを送信しました
              </h1>
              <p className="text-sm leading-6 text-text-body">
                ご登録いただいたメールアドレスに確認メールを送信しました。
                <br />
                メール内のリンクをクリックして登録を完了してください。
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-card-border bg-background px-4 text-sm font-medium text-text-dark transition-colors hover:bg-tab-bg"
            >
              ログインページへ
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
