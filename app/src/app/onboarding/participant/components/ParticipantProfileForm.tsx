"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { User, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { registerParticipant } from "@/lib/onboarding/actions";

export function ParticipantProfileForm() {
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

      router.push("/diagnosis");
    } catch {
      setError("登録中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[480px]">
        <CardHeader>
          <h1 className="text-center text-2xl font-bold tracking-tight text-text-dark">
            プロフィール登録
          </h1>
          <p className="mt-2 text-center text-sm text-text-body">
            ボランティア活動に参加するためのプロフィールを登録してください。
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
              placeholder="東京都"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              autoComplete="address-level1"
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
    </div>
  );
}
