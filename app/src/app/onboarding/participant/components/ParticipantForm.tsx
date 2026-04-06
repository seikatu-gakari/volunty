"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { User, MapPin } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { registerParticipant } from "@/lib/onboarding/actions";

export function ParticipantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await registerParticipant({ name, region });

      if (!result.success) {
        setError(result.error ?? "登録に失敗しました");
        return;
      }

      // 登録成功 — ホームへリダイレクト
      router.push("/");
    } catch (err) {
      console.error("[ParticipantForm] Error:", err);
      setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-[480px]">
      <CardHeader>
        <h1 className="text-center text-2xl font-bold tracking-tight text-text-dark">
          プロフィール登録
        </h1>
        <p className="mt-1 text-center text-sm text-text-body">
          活動に必要な基本情報を入力してください
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="お名前"
            icon={User}
            type="text"
            placeholder="山田 太郎"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="希望地域"
            icon={MapPin}
            type="text"
            placeholder="東京都・神奈川県など"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            required
          />

          {error && (
            <p className="text-center text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登録中..." : "登録する"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
