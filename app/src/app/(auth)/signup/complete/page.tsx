"use client";

import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { ProgressBar } from "@/app/components/ui/ProgressBar";

export default function SignupCompletePage() {
  const router = useRouter();

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
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/login")}
            >
              ログインページへ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
