"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { FileText, AlignLeft, Brain, ArrowLeft, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { createOpportunity } from "@/lib/dashboard/actions";

/** BIG5 特性の日本語ラベル */
const BIG5_TRAITS = [
  { key: "extraversion", label: "外向性" },
  { key: "agreeableness", label: "協調性" },
  { key: "conscientiousness", label: "誠実性" },
  { key: "neuroticism", label: "神経症傾向" },
  { key: "openness", label: "開放性" },
] as const;

export function OpportunityForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traitValues, setTraitValues] = useState<Record<string, number>>({
    extraversion: 50,
    agreeableness: 50,
    conscientiousness: 50,
    neuroticism: 50,
    openness: 50,
  });
  const [enabledTraits, setEnabledTraits] = useState<Record<string, boolean>>({
    extraversion: false,
    agreeableness: false,
    conscientiousness: false,
    neuroticism: false,
    openness: false,
  });

  const handleTraitChange = (trait: string, value: number) => {
    setTraitValues((prev) => ({ ...prev, [trait]: value }));
  };

  const handleTraitToggle = (trait: string) => {
    setEnabledTraits((prev) => ({ ...prev, [trait]: !prev[trait] }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);

      // 無効化されている特性のフィールドは送信しない
      for (const trait of BIG5_TRAITS) {
        if (!enabledTraits[trait.key]) {
          formData.delete(`trait_${trait.key}`);
        }
      }

      const result = await createOpportunity(formData);
      if (!result.success) {
        setError(result.error ?? "案件の作成に失敗しました");
        setLoading(false);
      }
      // 成功時は Server Action 内で redirect されるため、ここには到達しない
    } catch {
      setError("案件の作成中にエラーが発生しました");
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Plus className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-dark">
              新しい募集案件を作成
            </h1>
            <p className="text-sm text-text-body">
              ボランティアを募集する案件情報を入力してください
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 案件タイトル */}
          <Input
            label="案件タイトル"
            name="title"
            icon={FileText}
            type="text"
            placeholder="例: 環境保全ボランティア"
            required
          />

          {/* 案件説明 */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="description"
              className="text-sm font-medium text-text-dark"
            >
              案件説明
            </label>
            <div className="relative">
              <AlignLeft className="pointer-events-none absolute left-3 top-3 size-4 text-text-body" />
              <textarea
                id="description"
                name="description"
                rows={5}
                required
                placeholder="活動内容、日時、場所、参加条件などを記載してください"
                className="w-full rounded-lg border border-input-border bg-white py-2 pl-10 pr-3 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* 求める性格特性 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <span className="text-sm font-medium text-text-dark">
                求める性格特性（任意）
              </span>
            </div>
            <p className="text-xs text-text-body">
              チェックを入れた特性のスコアがマッチング時に考慮されます（0〜100）
            </p>
            <div className="flex flex-col gap-4 rounded-lg border border-card-border bg-background/50 p-4">
              {BIG5_TRAITS.map((trait) => (
                <div key={trait.key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`enable_${trait.key}`}
                      checked={enabledTraits[trait.key]}
                      onChange={() => handleTraitToggle(trait.key)}
                      className="size-4 accent-primary"
                    />
                    <label
                      htmlFor={`enable_${trait.key}`}
                      className="text-sm font-medium text-text-dark"
                    >
                      {trait.label}
                    </label>
                    {enabledTraits[trait.key] && (
                      <span className="ml-auto text-sm font-medium text-primary">
                        {traitValues[trait.key]}
                      </span>
                    )}
                  </div>
                  {enabledTraits[trait.key] && (
                    <div className="flex items-center gap-3 pl-7">
                      <span className="text-xs text-text-body">0</span>
                      <input
                        type="range"
                        name={`trait_${trait.key}`}
                        min={0}
                        max={100}
                        value={traitValues[trait.key]}
                        onChange={(e) =>
                          handleTraitChange(trait.key, Number(e.target.value))
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-card-border accent-primary"
                      />
                      <span className="text-xs text-text-body">100</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* エラーメッセージ */}
          {error && (
            <p className="text-center text-sm text-red-600">{error}</p>
          )}

          {/* ボタン */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link href="/dashboard">
              <Button
                type="button"
                variant="outline"
                icon={ArrowLeft}
                className="w-full sm:w-auto"
              >
                キャンセル
              </Button>
            </Link>
            <Button
              type="submit"
              icon={Plus}
              className="w-full sm:w-auto"
              disabled={loading}
            >
              {loading ? "作成中..." : "作成する"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
