"use client";

import { useState, type FormEvent } from "react";
import { User, MapPin } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { ProgressBar } from "@/app/components/ui/ProgressBar";
import { registerParticipantProfile } from "@/lib/onboarding/actions";

export default function OnboardingParticipantPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      await registerParticipantProfile(formData);
    } catch {
      setError("プロフィールの保存中にエラーが発生しました");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[640px]">
        <CardContent>
          <div className="flex flex-col gap-6">
            <ProgressBar value={66} />
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-text-dark">
                プロフィール登録
              </h1>
              <p className="text-sm text-text-body">
                あなたのことを教えてください
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="お名前"
                name="name"
                icon={User}
                type="text"
                placeholder="山田 太郎"
                required
                autoComplete="name"
              />
              <Input
                label="希望地域"
                name="preferredLocation"
                icon={MapPin}
                type="text"
                placeholder="東京都渋谷区"
              />
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="bio"
                  className="text-sm font-medium text-text-dark"
                >
                  自己紹介
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  placeholder="趣味や興味のあることなど"
                  className="w-full rounded-lg border border-input-border bg-white px-3 py-2 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {error && (
                <p className="text-center text-sm text-red-600">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "保存中..." : "登録を完了する"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
