"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  User,
  Mail,
  Globe,
  FileText,
  Tag,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
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

const CATEGORIES = [
  "環境保全", "子ども支援", "高齢者支援", "国際交流",
  "教育", "災害支援", "動物保護", "まちづくり",
];

export interface OrganizationProfileFormProps {
  isEdit?: boolean;
  /**
   * 編集モード
   * - reapply: 否認後の再申請
   * - approved: 承認済みプロフィールの修正（保存後に再審査へ）
   */
  editMode?: "reapply" | "approved";
  defaultValues?: {
    organizationName: string;
    representativeName: string;
    contactEmail: string;
    activityAreas: string[];
    description: string;
    activityCategories: string[];
    websiteUrl: string;
    logoUrl: string;
    contactLineId: string;
    contactLineUrl: string;
  } | null;
}

export function OrganizationProfileForm({
  isEdit = false,
  editMode,
  defaultValues,
}: OrganizationProfileFormProps = {}) {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState(defaultValues?.organizationName || "");
  const [representativeName, setRepresentativeName] = useState(defaultValues?.representativeName || "");
  const [contactEmail, setContactEmail] = useState(defaultValues?.contactEmail || "");
  const [activityAreas, setActivityAreas] = useState<string[]>(defaultValues?.activityAreas || []);
  const [description, setDescription] = useState(defaultValues?.description || "");
  const [activityCategories, setActivityCategories] = useState<string[]>(defaultValues?.activityCategories || []);
  const [websiteUrl, setWebsiteUrl] = useState(defaultValues?.websiteUrl || "");
  const [logoUrl, setLogoUrl] = useState(defaultValues?.logoUrl || "");
  const [contactLineId, setContactLineId] = useState(defaultValues?.contactLineId || "");
  const [contactLineUrl, setContactLineUrl] = useState(defaultValues?.contactLineUrl || "");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleArea = (area: string) => {
    setActivityAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const toggleCategory = (cat: string) => {
    setActivityCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const normalizedContactLineId = contactLineId.trim();
      if (!normalizedContactLineId) {
        setError("LINE公式アカウントIDは必須です");
        setLoading(false);
        return;
      }

      const result = await registerOrganization({
        organizationName,
        representativeName,
        contactEmail,
        activityAreas,
        description: description || undefined,
        activityCategories: activityCategories.length > 0 ? activityCategories : undefined,
        websiteUrl: websiteUrl || undefined,
        logoUrl: logoUrl || undefined,
        contactLineId: normalizedContactLineId,
        contactLineUrl: contactLineUrl || undefined,
      });

      if (!result.success) {
        setError(result.error ?? "登録に失敗しました");
        return;
      }

      // 登録・更新後は審査待ち画面へ
      router.push("/onboarding/pending");
    } catch {
      setError("登録中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const labelClass = "text-sm font-medium text-text-dark";
  const selectClass =
    "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[640px]">
        <CardHeader>
          <h1 className="text-center text-2xl font-bold tracking-tight text-text-dark">
            {isEdit
              ? editMode === "reapply"
                ? "申請内容の修正"
                : "団体プロフィールの編集"
              : "団体プロフィール登録"}
          </h1>
          <p className="mt-2 text-center text-sm text-text-body">
            {isEdit
              ? "内容を更新して再申請を行います。"
              : "ボランティア募集を行うための団体情報を登録してください。"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
            {/* 基本情報セクション */}
            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-2 border-b border-card-border pb-2">
                <Building2 className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-text-dark">基本情報</h2>
              </div>

              <Input
                label="団体名"
                icon={Building2}
                placeholder="NPO法人 ボランティー"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  label="代表者名"
                  icon={User}
                  placeholder="山田 太郎"
                  value={representativeName}
                  onChange={(e) => setRepresentativeName(e.target.value)}
                  required
                />
                <Input
                  label="連絡先メールアドレス"
                  icon={Mail}
                  type="email"
                  placeholder="contact@example.org"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />
              </div>

              <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
                <legend className={labelClass}>
                  主な活動地域（複数選択可・必須）{" "}
                  <span aria-hidden="true" className="text-red-500">
                    *
                  </span>
                </legend>
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-card-border bg-background p-3 sm:grid-cols-4 md:grid-cols-6">
                  {PREFECTURES.map((area) => (
                    <label
                      key={area}
                      className="relative flex h-full cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="activityAreas"
                        value={area}
                        className="peer sr-only"
                        checked={activityAreas.includes(area)}
                        onChange={() => toggleArea(area)}
                      />
                      <span
                        className={`flex h-full w-full items-center justify-center rounded-md border py-1.5 text-xs transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
                        activityAreas.includes(area)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-card-border bg-white text-text-body hover:bg-gray-50"
                      }`}
                      >
                        {area}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            {/* 詳細情報セクション */}
            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-2 border-b border-card-border pb-2">
                <FileText className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-text-dark">詳細情報（任意）</h2>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>活動分野</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CATEGORIES.map((cat) => (
                    <label
                      key={cat}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        activityCategories.includes(cat)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-card-border bg-white text-text-body hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={activityCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>団体説明</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="団体の目的や主な活動内容について教えてください"
                  rows={5}
                  className={`${selectClass} resize-none`}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  label="ウェブサイト URL"
                  icon={Globe}
                  type="url"
                  placeholder="https://example.org"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
                <Input
                  label="ロゴ画像 URL"
                  icon={Tag}
                  type="url"
                  placeholder="https://example.org/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>
            </section>

            {/* 連絡先連携セクション */}
            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-2 border-b border-card-border pb-2">
                <MessageCircle className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-text-dark">LINE 連携</h2>
              </div>
              <div className="flex flex-col gap-1 text-xs text-text-body">
                <p>参加者との連絡に使用する団体・公式LINEアカウントのIDを入力してください。</p>
                <p>個人アカウントではなく、団体で管理できるアカウントの利用を推奨します。</p>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  label="LINE公式アカウントID"
                  icon={MessageCircle}
                  placeholder="@volunty_npo"
                  value={contactLineId}
                  onChange={(e) => setContactLineId(e.target.value)}
                  required
                />
                <Input
                  label="LINE 友達追加 URL"
                  icon={ExternalLink}
                  type="url"
                  placeholder="https://line.me/R/ti/p/..."
                  value={contactLineUrl}
                  onChange={(e) => setContactLineUrl(e.target.value)}
                />
              </div>
            </section>

            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "送信中..."
                : isEdit
                  ? "内容を更新して再申請する"
                  : "登録して審査を申請する"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
