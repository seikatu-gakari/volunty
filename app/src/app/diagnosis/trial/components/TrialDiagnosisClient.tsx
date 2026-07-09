"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/Card";
import { QuestionCard } from "@/app/diagnosis/components/QuestionCard";
import {
  getItemsInDisplayOrder,
  getScaleDefinition,
} from "@/lib/diagnosis-scale/scale";
import { scoreDiagnosis } from "@/lib/diagnosis-scale/scoring";
import { findClosestStyleType } from "@/lib/diagnosis-scale/style-types";
import type { DiagnosisAnswer } from "@/lib/diagnosis-scale/types";

export function TrialDiagnosisClient() {
  const scale = useMemo(() => getScaleDefinition("brief"), []);
  const items = useMemo(() => getItemsInDisplayOrder(scale), [scale]);
  const [answers, setAnswers] = useState<DiagnosisAnswer[]>([]);

  const currentItem = items[answers.length];
  const scoring =
    answers.length === items.length ? scoreDiagnosis(answers, scale) : null;
  const style =
    scoring?.success === true
      ? findClosestStyleType(scoring.score.scaledScores).type
      : null;

  function handleAnswer(value: number) {
    if (!currentItem) return;
    setAnswers((current) => [
      ...current,
      {
        itemCode: currentItem.itemCode,
        value,
        elapsedMs: 1000,
      },
    ]);
  }

  if (!currentItem && style && scoring?.success) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-6 py-10">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-text-body">お試し結果</p>
              <h1 className="text-2xl font-bold text-text-dark">
                {style.name}
              </h1>
            </div>
          </div>
          <p className="text-sm leading-6 text-text-body">{style.description}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {style.tendencies.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-card-border bg-background px-4 py-3 text-sm text-text-dark"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-primary/5 p-4 text-xs leading-6 text-text-body">
            簡易15問のお試し結果です。保存やおすすめ精度の反映には、参加者登録後に診断を完了してください。
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding/role"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
            >
              登録して結果を活用する
              <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => setAnswers([])}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-card-border bg-white px-4 text-sm font-medium text-text-dark hover:bg-background"
            >
              <RotateCcw className="size-4" />
              もう一度試す
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <QuestionCard
      item={currentItem}
      onAnswer={handleAnswer}
      onBack={() => setAnswers((current) => current.slice(0, -1))}
      canGoBack={answers.length > 0}
      currentStep={answers.length + 1}
      totalSteps={items.length}
    />
  );
}
