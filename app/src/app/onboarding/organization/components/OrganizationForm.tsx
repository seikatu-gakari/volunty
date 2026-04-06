"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, MessageCircle, Mail } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { registerOrganization } from "@/lib/onboarding/actions";

export function OrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lineId, setLineId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await registerOrganization({
        name,
        description,
        line_id: lineId,
        contact_email: contactEmail,
      });

      if (!result.success) {
        setError(result.error ?? "登録に失敗しました");
        return;
      }

      // 登録成功 — 審査待ち画面へリダイレクト
      router.push("/onboarding/pending");
    } catch (err) {
      console.error("[OrganizationForm] Error:", err);
      setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-[520px]">
      <CardHeader>
        <h1 className="text-center text-2xl font-bold tracking-tight text-text-dark">
          団体プロフィール登録
        </h1>
        <p className="mt-1 text-center text-sm text-text-body">
          団体情報を入力してください。登録後、管理者が審査を行います。
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="団体名"
            icon={Building2}
            type="text"
            placeholder="〇〇ボランティア団体"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1">
            <label
              htmlFor="description"
              className="text-sm font-medium text-text-dark"
            >
              団体の説明
            </label>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3 top-3 size-4 text-text-body" />
              <textarea
                id="description"
                placeholder="活動内容・目的・特徴などを記入してください"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                className="w-full rounded-lg border border-input-border bg-white py-2 pl-10 pr-3 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <Input
            label="LINE ID（マッチング成立時に参加者へ開示）"
            icon={MessageCircle}
            type="text"
            placeholder="@voluntyorg"
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            required
          />

          <Input
            label="連絡先メールアドレス"
            icon={Mail}
            type="email"
            placeholder="contact@example.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
            autoComplete="email"
          />

          {error && (
            <p className="text-center text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登録中..." : "登録して審査を申請する"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
