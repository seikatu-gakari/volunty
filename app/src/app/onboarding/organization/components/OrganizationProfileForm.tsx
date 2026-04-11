"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, Mail, Globe, Link, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { registerOrganization } from "@/lib/onboarding/actions";

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const ACTIVITY_CATEGORIES = [
  "環境保全", "子ども支援", "高齢者支援", "国際交流",
  "教育・学習支援", "災害支援", "動物保護", "まちづくり",
  "貧困・生活困窮支援", "障がい者支援", "医療・健康",
  "文化・芸術", "スポーツ", "その他",
];

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "基本情報",
  2: "団体の魅力",
  3: "連絡手段",
};

export function OrganizationProfileForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1 フィールド（必須）
  const [organizationName, setOrganizationName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [activityAreas, setActivityAreas] = useState<string[]>([]);

  // Step 2 フィールド（任意）
  const [description, setDescription] = useState("");
  const [activityCategories, setActivityCategories] = useState<string[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Step 3 フィールド（任意）
  const [contactLineId, setContactLineId] = useState("");
  const [contactLineUrl, setContactLineUrl] = useState("");

  const toggleArea = (area: string) => {
    setActivityAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const toggleCategory = (category: string) => {
    setActivityCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  /** Step 1 のバリデーション */
  const validateStep1 = (): string | null => {
    if (!organizationName.trim()) return "団体名を入力してください";
    if (!representativeName.trim()) return "代表者名を入力してください";
    if (!contactEmail.trim()) return "連絡先メールアドレスを入力してください";
    if (activityAreas.length === 0) return "活動地域を1つ以上選択してください";
    return null;
  };

  const handleStep1Next = (e: FormEvent) => {
    e.preventDefault();
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (skipToEnd = false) => {
    setError(null);
    setLoading(true);

    try {
      const result = await registerOrganization({
        organizationName,
        representativeName,
        contactEmail,
        activityAreas,
        description: skipToEnd ? undefined : description.trim() || undefined,
        activityCategories:
          skipToEnd || activityCategories.length === 0
            ? undefined
            : activityCategories,
        websiteUrl: skipToEnd ? undefined : websiteUrl.trim() || undefined,
        logoUrl: skipToEnd ? undefined : logoUrl.trim() || undefined,
        contactLineId: contactLineId.trim() || undefined,
        contactLineUrl: contactLineUrl.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error ?? "登録に失敗しました");
        return;
      }

      router.push("/onboarding/pending");
    } catch {
      setError("登録中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Next = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep(3);
  };

  const handleStep2Skip = () => {
    handleSubmit(true);
  };

  const handleStep3Submit = (e: FormEvent) => {
    e.preventDefault();
    handleSubmit(false);
  };

  const handleStep3Skip = () => {
    handleSubmit(false);
  };

  const selectClass =
    "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary";

  /** ステップインジケーター */
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {([1, 2, 3] as Step[]).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
              s === step
                ? "bg-primary text-white"
                : s < step
                  ? "bg-primary/30 text-primary"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {s}
          </div>
          <span
            className={`hidden text-xs sm:block ${
              s === step ? "font-medium text-text-dark" : "text-text-body"
            }`}
          >
            {STEP_LABELS[s]}
          </span>
          {s < 3 && <div className="h-px w-6 bg-gray-200" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[560px]">
        <CardHeader>
          <h1 className="text-center text-2xl font-bold tracking-tight text-text-dark">
            団体プロフィール登録
          </h1>
          <p className="mt-2 text-center text-sm text-text-body">
            ボランティアを募集するための団体プロフィールを登録してください。
          </p>
        </CardHeader>
        <CardContent>
          <StepIndicator />

          {/* ===== Step 1: 基本情報（必須） ===== */}
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="flex flex-col gap-5">
              <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm text-text-body">
                <span className="font-medium text-primary">Step 1</span>
                　基本情報を入力してください。すべて必須項目です。
              </div>

              <Input
                label="団体名 *"
                icon={Building2}
                type="text"
                placeholder="NPO法人〇〇の会"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                maxLength={100}
                required
                autoComplete="organization"
              />

              <Input
                label="代表者名 *"
                icon={User}
                type="text"
                placeholder="山田 太郎"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                maxLength={50}
                required
                autoComplete="name"
              />

              <Input
                label="連絡先メールアドレス *"
                icon={Mail}
                type="email"
                placeholder="contact@example.org"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                autoComplete="email"
              />

              {/* 活動地域（マルチセレクト） */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-dark">
                  活動地域 <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs font-normal text-text-body">（複数選択可）</span>
                </label>
                <div
                  className="max-h-48 overflow-y-auto rounded-lg border border-card-border bg-white p-3"
                  role="group"
                  aria-label="活動地域の選択"
                >
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                    {PREFECTURES.map((pref) => (
                      <label
                        key={pref}
                        className="flex cursor-pointer items-center gap-2 text-sm text-text-body"
                      >
                        <input
                          type="checkbox"
                          checked={activityAreas.includes(pref)}
                          onChange={() => toggleArea(pref)}
                          className="accent-primary"
                        />
                        {pref}
                      </label>
                    ))}
                  </div>
                </div>
                {activityAreas.length > 0 && (
                  <p className="text-xs text-primary">
                    {activityAreas.length}件選択中
                  </p>
                )}
              </div>

              {error && (
                <p className="text-center text-sm text-red-600">{error}</p>
              )}

              <Button type="submit" className="w-full">
                次へ：団体の魅力を入力する →
              </Button>
            </form>
          )}

          {/* ===== Step 2: 団体の魅力（任意） ===== */}
          {step === 2 && (
            <form onSubmit={handleStep2Next} className="flex flex-col gap-5">
              <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm text-text-body">
                <span className="font-medium text-primary">Step 2</span>
                　団体の魅力を伝えましょう。あとで補完することもできます。
              </div>

              {/* 団体説明 */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-dark">
                  団体説明（任意）
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="活動内容や理念、ボランティアへのメッセージをご記入ください"
                  rows={4}
                  maxLength={1000}
                  className={`${selectClass} resize-none`}
                />
                <p className="text-right text-xs text-text-body">
                  {description.length} / 1000
                </p>
              </div>

              {/* 活動カテゴリ */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-dark">
                  活動カテゴリ（任意・複数可）
                </label>
                <div
                  className="grid grid-cols-2 gap-2"
                  role="group"
                  aria-label="活動カテゴリの選択"
                >
                  {ACTIVITY_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className="flex cursor-pointer items-center gap-2 text-sm text-text-body"
                    >
                      <input
                        type="checkbox"
                        checked={activityCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                        className="accent-primary"
                      />
                      {category}
                    </label>
                  ))}
                </div>
              </div>

              <Input
                label="ウェブサイトURL（任意）"
                icon={Globe}
                type="url"
                placeholder="https://example.org"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />

              <Input
                label="ロゴ・写真URL（任意）"
                icon={Link}
                type="url"
                placeholder="https://example.org/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />

              {error && (
                <p className="text-center text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  ← 戻る
                </Button>
                <Button type="submit" className="flex-1">
                  次へ：連絡手段を設定する →
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                disabled={loading}
                onClick={handleStep2Skip}
              >
                {loading ? "登録中..." : "スキップして登録を完了する"}
              </Button>
            </form>
          )}

          {/* ===== Step 3: 連絡手段（任意） ===== */}
          {step === 3 && (
            <form onSubmit={handleStep3Submit} className="flex flex-col gap-5">
              <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm text-text-body">
                <span className="font-medium text-primary">Step 3</span>
                　LINE連絡先はマッチング成立後に参加者へ開示されます。
              </div>

              <Input
                label="LINE公式アカウントID（任意）"
                icon={MessageSquare}
                type="text"
                placeholder="@example_org"
                value={contactLineId}
                onChange={(e) => setContactLineId(e.target.value)}
              />

              <Input
                label="LINE追加URL（任意）"
                icon={Link}
                type="url"
                placeholder="https://line.me/R/ti/p/@example"
                value={contactLineUrl}
                onChange={(e) => setContactLineUrl(e.target.value)}
              />

              {error && (
                <p className="text-center text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  ← 戻る
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "登録中..." : "登録を完了する"}
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                disabled={loading}
                onClick={handleStep3Skip}
              >
                {loading ? "登録中..." : "スキップして登録を完了する"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
