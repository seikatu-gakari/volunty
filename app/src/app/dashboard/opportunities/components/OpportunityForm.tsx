"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  FileText,
  AlignLeft,
  Brain,
  ArrowLeft,
  Plus,
  Save,
  MapPin,
  Calendar,
  Users,
  Tag,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import type { OpportunityStatus, ParticipationMode } from "@/lib/dashboard/types";
import {
  CATEGORY_OPTIONS,
  PARTICIPATION_MODE_OPTIONS,
} from "@/lib/opportunities/constants";

/** BIG5 特性の日本語ラベル */
const BIG5_TRAITS = [
  { key: "extraversion", label: "外向性" },
  { key: "agreeableness", label: "協調性" },
  { key: "conscientiousness", label: "誠実性" },
  { key: "neuroticism", label: "神経症傾向" },
  { key: "openness", label: "開放性" },
] as const;

/** フォームの初期値 */
export interface OpportunityFormData {
  title: string;
  description: string;
  required_traits: Record<string, number> | null;
  status?: OpportunityStatus;
  /** 活動場所 */
  location?: string | null;
  /** 開始日（YYYY-MM-DD） */
  start_date?: string | null;
  /** 終了日（YYYY-MM-DD） */
  end_date?: string | null;
  /** 定員 */
  capacity?: number | null;
  /** カテゴリ */
  category?: string | null;
  /** 参加形態 */
  participation_mode?: ParticipationMode | null;
}

interface OpportunityFormProps {
  /** 編集モード時の初期データ */
  initialData?: OpportunityFormData;
  /** "create" = 新規作成、"edit" = 編集 */
  mode?: "create" | "edit";
  /** フォーム送信時の Server Action */
  onSubmitAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  /** キャンセルボタンのリンク先 */
  cancelHref: string;
}

export function OpportunityForm({
  initialData,
  mode = "create",
  onSubmitAction,
  cancelHref,
}: OpportunityFormProps) {
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初期値の特性スコアを設定
  const initialTraitValues: Record<string, number> = {
    extraversion: 50,
    agreeableness: 50,
    conscientiousness: 50,
    neuroticism: 50,
    openness: 50,
  };
  const initialEnabledTraits: Record<string, boolean> = {
    extraversion: false,
    agreeableness: false,
    conscientiousness: false,
    neuroticism: false,
    openness: false,
  };

  // 編集モード時は既存の required_traits を反映
  if (initialData?.required_traits) {
    for (const [key, value] of Object.entries(initialData.required_traits)) {
      if (key in initialTraitValues) {
        initialTraitValues[key] = value;
        initialEnabledTraits[key] = true;
      }
    }
  }

  const [traitValues, setTraitValues] =
    useState<Record<string, number>>(initialTraitValues);
  const [enabledTraits, setEnabledTraits] =
    useState<Record<string, boolean>>(initialEnabledTraits);
  const [status, setStatus] = useState<OpportunityStatus>(
    initialData?.status ?? "published"
  );

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

      // 編集モード時はステータスを追加
      if (isEdit) {
        formData.set("status", status);
      }

      const result = await onSubmitAction(formData);
      if (!result.success) {
        setError(result.error ?? `案件の${isEdit ? "更新" : "作成"}に失敗しました`);
        setLoading(false);
      }
      // 成功時は Server Action 内で redirect されるため、ここには到達しない
    } catch {
      setError(`案件の${isEdit ? "更新" : "作成"}中にエラーが発生しました`);
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            {isEdit ? (
              <Save className="size-5 text-primary" />
            ) : (
              <Plus className="size-5 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-dark">
              {isEdit ? "募集案件を編集" : "新しい募集案件を作成"}
            </h1>
            <p className="text-sm text-text-body">
              {isEdit
                ? "案件情報を更新してください"
                : "ボランティアを募集する案件情報を入力してください"}
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
            defaultValue={initialData?.title ?? ""}
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
                defaultValue={initialData?.description ?? ""}
                placeholder="活動内容、日時、場所、参加条件などを記載してください"
                className="w-full rounded-lg border border-input-border bg-white py-2 pl-10 pr-3 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* 募集情報 */}
          <div className="flex flex-col gap-4">
            {/* 活動場所 */}
            <Input
              label="活動場所（任意）"
              name="location"
              icon={MapPin}
              type="text"
              placeholder="例: 渋谷区 / オンライン"
              defaultValue={initialData?.location ?? ""}
            />

            {/* 開始日・終了日 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="startDate"
                  className="text-sm font-medium text-text-dark"
                >
                  開始日（任意）
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-body" />
                  <input
                    id="startDate"
                    name="startDate"
                    type="date"
                    defaultValue={initialData?.start_date ?? ""}
                    className="w-full rounded-lg border border-input-border bg-white py-2 pl-10 pr-3 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="endDate"
                  className="text-sm font-medium text-text-dark"
                >
                  終了日（任意）
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-body" />
                  <input
                    id="endDate"
                    name="endDate"
                    type="date"
                    defaultValue={initialData?.end_date ?? ""}
                    className="w-full rounded-lg border border-input-border bg-white py-2 pl-10 pr-3 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            {/* 定員 */}
            <Input
              label="定員（任意）"
              name="capacity"
              icon={Users}
              type="number"
              min={1}
              placeholder="例: 10"
              defaultValue={
                initialData?.capacity != null ? String(initialData.capacity) : ""
              }
            />

            {/* カテゴリ */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="category"
                className="text-sm font-medium text-text-dark"
              >
                カテゴリ（任意）
              </label>
              <div className="relative">
                <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-body" />
                <select
                  id="category"
                  name="category"
                  defaultValue={initialData?.category ?? ""}
                  className="w-full appearance-none rounded-lg border border-input-border bg-white py-2 pl-10 pr-3 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">指定しない</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 参加形態 */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="participationMode"
                className="text-sm font-medium text-text-dark"
              >
                参加形態（任意）
              </label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-body" />
                <select
                  id="participationMode"
                  name="participationMode"
                  defaultValue={initialData?.participation_mode ?? ""}
                  className="w-full appearance-none rounded-lg border border-input-border bg-white py-2 pl-10 pr-3 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">指定しない</option>
                  {PARTICIPATION_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 案件ステータス（編集モードのみ） */}
          {isEdit && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-dark">
                案件ステータス
              </span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-text-body">
                  <input
                    type="radio"
                    name="status_radio"
                    value="published"
                    checked={status === "published"}
                    onChange={() => setStatus("published")}
                    className="accent-primary"
                  />
                  募集中
                </label>
                <label className="flex items-center gap-2 text-sm text-text-body">
                  <input
                    type="radio"
                    name="status_radio"
                    value="closed"
                    checked={status === "closed"}
                    onChange={() => setStatus("closed")}
                    className="accent-primary"
                  />
                  募集終了
                </label>
              </div>
            </div>
          )}

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
                      className="size-4 accent-primary focus:ring-2 focus:ring-primary/50"
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
                        aria-label={`${trait.label}のスコア`}
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
            <Link href={cancelHref}>
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
              icon={isEdit ? Save : Plus}
              className="w-full sm:w-auto"
              disabled={loading}
            >
              {loading
                ? isEdit
                  ? "保存中..."
                  : "作成中..."
                : isEdit
                  ? "保存する"
                  : "作成する"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
