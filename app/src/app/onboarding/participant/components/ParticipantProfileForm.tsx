"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { registerParticipant } from "@/lib/onboarding/actions";

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

const INTERESTS = [
  "環境保全", "子ども支援", "高齢者支援", "国際交流",
  "教育", "災害支援", "動物保護", "まちづくり",
];

const CURRENT_YEAR = new Date().getFullYear();
// 参加者の年齢を考慮: 1歳〜150歳を対象とした範囲
const YEARS = Array.from({ length: 150 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** 生年月日が有効かどうかをチェック（存在する日付かつ現在以前） */
function isValidBirthday(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(y, m - 1, d);
  // 月をまたいだ繰り上がりがないか（例: 2月30日は3月に繰り上がる）
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return false;
  }
  // 未来の日付は不可
  if (date > new Date()) {
    return false;
  }
  return true;
}

export interface ParticipantProfileFormProps {
  isEdit?: boolean;
  defaultValues?: {
    name: string;
    birthYear: string;
    birthMonth: string;
    birthDay: string;
    gender: string;
    region: string;
    bio: string;
    lineId: string;
    interests: string[];
  };
  onSuccessRedirect?: string;
}

export function ParticipantProfileForm({
  isEdit = false,
  defaultValues,
  onSuccessRedirect = "/diagnosis",
}: ParticipantProfileFormProps = {}) {
  const router = useRouter();
  const [name, setName] = useState(defaultValues?.name || "");
  const [birthYear, setBirthYear] = useState(defaultValues?.birthYear || "");
  const [birthMonth, setBirthMonth] = useState(defaultValues?.birthMonth || "");
  const [birthDay, setBirthDay] = useState(defaultValues?.birthDay || "");
  const [gender, setGender] = useState(defaultValues?.gender || "");
  const [region, setRegion] = useState(defaultValues?.region || "");
  const [bio, setBio] = useState(defaultValues?.bio || "");
  const [lineId, setLineId] = useState(defaultValues?.lineId || "");
  const [interests, setInterests] = useState<string[]>(defaultValues?.interests || []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const birthday =
      birthYear && birthMonth && birthDay
        ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`
        : "";

    // 生年月日の日付整合性チェック
    if (birthYear && birthMonth && birthDay && !isValidBirthday(birthYear, birthMonth, birthDay)) {
      setError("有効な生年月日を入力してください（未来の日付や存在しない日付は無効です）");
      setLoading(false);
      return;
    }

    try {
      const result = await registerParticipant({
        name,
        birthday,
        gender: gender || undefined,
        region,
        bio: bio || undefined,
        lineId: lineId || undefined,
        interests: interests.length > 0 ? interests : undefined,
      });

      if (!result.success) {
        setError(result.error ?? "登録に失敗しました");
        return;
      }

      router.push(onSuccessRedirect);
    } catch {
      setError("登録中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const selectClass =
    "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-[520px]">
        <CardHeader>
          <h1 className="text-center text-2xl font-bold tracking-tight text-text-dark">
            {isEdit ? "プロフィール編集" : "参加者プロフィール登録"}
          </h1>
          <p className="mt-2 text-center text-sm text-text-body">
            {isEdit
              ? "登録されているプロフィールを更新します。"
              : "ボランティア活動に参加するためのプロフィールを登録してください。"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* 表示名 */}
            <Input
              label="表示名"
              icon={User}
              type="text"
              placeholder="山田 太郎"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />

            {/* 生年月日 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-dark">
                生年月日 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(7rem,1.4fr)_minmax(5rem,1fr)_minmax(5rem,1fr)]">
                <select
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  required
                  className={`${selectClass} col-span-2 w-full min-w-0 sm:col-span-1`}
                  aria-label="年"
                >
                  <option value="">年</option>
                  {YEARS.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}年
                    </option>
                  ))}
                </select>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  required
                  className={`${selectClass} w-full min-w-0`}
                  aria-label="月"
                >
                  <option value="">月</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={String(m)}>
                      {m}月
                    </option>
                  ))}
                </select>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  required
                  className={`${selectClass} w-full min-w-0`}
                  aria-label="日"
                >
                  <option value="">日</option>
                  {DAYS.map((d) => (
                    <option key={d} value={String(d)}>
                      {d}日
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 性別 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-dark">性別</label>
              <div className="flex flex-wrap gap-4">
                {[
                  { value: "male", label: "男性" },
                  { value: "female", label: "女性" },
                  { value: "other", label: "その他" },
                  { value: "undisclosed", label: "回答しない" },
                ].map(({ value, label }) => (
                  <label key={value} className="flex cursor-pointer items-center gap-1.5 text-sm text-text-body">
                    <input
                      type="radio"
                      name="gender"
                      value={value}
                      checked={gender === value}
                      onChange={() => setGender(value)}
                      className="accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* 都道府県 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-dark">
                お住まいの都道府県 <span className="text-red-500">*</span>
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                required
                className={selectClass}
                aria-label="都道府県"
              >
                <option value="">選択してください</option>
                {PREFECTURES.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>
            </div>

            {/* 自己紹介 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-dark">
                自己紹介（任意）
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="自己紹介を入力してください"
                rows={3}
                className={`${selectClass} resize-none`}
              />
            </div>

            {/* 興味のある分野 */}
            <div className="flex flex-col gap-1">
              <Input
                label="LINE ID（任意）"
                type="text"
                placeholder="例: volunteer_taro"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs leading-5 text-text-body">
                LINE IDは、応募した団体とのマッチングが成立した場合にのみ、その団体へ共有されます。マッチング成立前や他の団体には公開されません。
              </p>
            </div>

            {/* 興味のある分野 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-dark">
                興味のある分野（任意・複数可）
              </label>
              <div className="grid grid-cols-2 gap-2">
                {INTERESTS.map((interest) => (
                  <label
                    key={interest}
                    className="flex cursor-pointer items-center gap-2 text-sm text-text-body"
                  >
                    <input
                      type="checkbox"
                      checked={interests.includes(interest)}
                      onChange={() => toggleInterest(interest)}
                      className="accent-primary"
                    />
                    {interest}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? isEdit
                  ? "更新中..."
                  : "登録中..."
                : isEdit
                  ? "更新する"
                  : "登録して診断へ進む"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
