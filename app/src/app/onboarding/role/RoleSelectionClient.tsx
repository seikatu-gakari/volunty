"use client";

import { useState } from "react";
import { Users, Building2 } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { ProgressBar } from "@/app/components/ui/ProgressBar";
import { selectRole } from "@/lib/onboarding/actions";

type Role = "participant" | "organization";

export function RoleSelectionClient() {
  const [selected, setSelected] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);

    try {
      await selectRole(selected);
    } catch {
      setError("ロールの保存中にエラーが発生しました");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[640px]">
        <CardContent>
          <div className="flex flex-col gap-6">
            <ProgressBar value={33} />
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-text-dark">
                利用方法を選択
              </h1>
              <p className="text-sm text-text-body">
                ボランティーをどのように利用しますか？
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <RoleCard
                selected={selected === "participant"}
                onClick={() => setSelected("participant")}
                icon={<Users className="size-8 text-primary" />}
                title="ボランティアに参加する"
                description="性格診断を受けて、自分に合ったボランティア活動を見つけましょう"
              />
              <RoleCard
                selected={selected === "organization"}
                onClick={() => setSelected("organization")}
                icon={<Building2 className="size-8 text-primary" />}
                title="ボランティアを募集する"
                description="団体として募集案件を作成し、相性の良い参加者を見つけましょう"
              />
            </div>

            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}

            <Button
              className="w-full"
              disabled={!selected || loading}
              onClick={handleSubmit}
            >
              {loading ? "処理中..." : "次へ"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RoleCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-start gap-4 rounded-[10px] border-2 p-5 text-left transition-colors ${selected
          ? "border-primary bg-primary/5"
          : "border-card-border bg-white hover:border-primary/50"
        }`}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex flex-col gap-1">
        <span className="text-base font-bold text-text-dark">{title}</span>
        <span className="text-sm text-text-body">{description}</span>
      </div>
    </button>
  );
}
