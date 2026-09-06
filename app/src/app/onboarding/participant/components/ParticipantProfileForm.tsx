"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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

type RequiredField =
  | "name"
  | "birthYear"
  | "birthMonth"
  | "birthDay"
  | "region";
type BirthdayField = "birthYear" | "birthMonth" | "birthDay";
type RequiredFieldElement = HTMLInputElement | HTMLSelectElement;

const REQUIRED_FIELD_IDS: Record<RequiredField, string> = {
  name: "participant-name",
  birthYear: "participant-birth-year",
  birthMonth: "participant-birth-month",
  birthDay: "participant-birth-day",
  region: "participant-region",
};

const REQUIRED_FIELD_ERROR_IDS: Record<RequiredField, string> = {
  name: "participant-name-error",
  birthYear: "participant-birth-year-error",
  birthMonth: "participant-birth-month-error",
  birthDay: "participant-birth-day-error",
  region: "participant-region-error",
};

const REQUIRED_FIELD_MESSAGES: Record<RequiredField, string> = {
  name: "表示名を入力してください",
  birthYear: "生年を選択してください",
  birthMonth: "生月を選択してください",
  birthDay: "生日を選択してください",
  region: "都道府県を選択してください",
};

const BIRTHDAY_ERROR_ID = "participant-birthday-error";
const BIRTHDAY_ERROR_MESSAGE =
  "有効な生年月日を入力してください（未来の日付や存在しない日付は無効です）";

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

function isRequiredField(value: string | undefined): value is RequiredField {
  return (
    value === "name" ||
    value === "birthYear" ||
    value === "birthMonth" ||
    value === "birthDay" ||
    value === "region"
  );
}

function isRequiredFieldElement(
  target: EventTarget | null
): target is RequiredFieldElement {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement;
}

function getRequiredField(
  element: RequiredFieldElement
): RequiredField | undefined {
  const field = element.dataset.requiredField;
  return isRequiredField(field) ? field : undefined;
}

function getFirstInvalidRequiredField(
  form: HTMLFormElement
): RequiredFieldElement | undefined {
  const elements = Array.from(
    form.querySelectorAll("input:invalid, select:invalid")
  );

  return elements.find(
    (element): element is RequiredFieldElement =>
      isRequiredFieldElement(element) && getRequiredField(element) !== undefined
  );
}

function getRequiredErrors(
  form: HTMLFormElement
): Partial<Record<RequiredField, string>> {
  const errors: Partial<Record<RequiredField, string>> = {};
  const elements = Array.from(form.querySelectorAll("[data-required-field]"));

  for (const element of elements) {
    if (!isRequiredFieldElement(element)) continue;

    const field = getRequiredField(element);
    if (field && !element.validity.valid) {
      errors[field] = REQUIRED_FIELD_MESSAGES[field];
    }
  }

  return errors;
}

function getBirthdayError(
  year: string,
  month: string,
  day: string
): string | null {
  if (!year || !month || !day) return null;
  return isValidBirthday(year, month, day) ? null : BIRTHDAY_ERROR_MESSAGE;
}

function getDescribedBy(
  errors: Partial<Record<RequiredField, string>>,
  field: RequiredField,
  additionalId?: string
): string | undefined {
  const ids = [
    errors[field] ? REQUIRED_FIELD_ERROR_IDS[field] : undefined,
    additionalId,
  ].filter((id): id is string => Boolean(id));

  return ids.length > 0 ? ids.join(" ") : undefined;
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
  const [requiredErrors, setRequiredErrors] = useState<
    Partial<Record<RequiredField, string>>
  >({});
  const [birthdayError, setBirthdayError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const pendingFocusFieldRef = useRef<RequiredField | null>(null);
  const focusFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
      }
      focusFrameRef.current = null;
      pendingFocusFieldRef.current = null;
    };
  }, []);

  const clearRequiredError = (field: RequiredField, value: string) => {
    if (!value) return;

    setRequiredErrors((previous) => {
      if (!previous[field]) return previous;

      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const scheduleFocus = (field: RequiredField) => {
    if (
      pendingFocusFieldRef.current !== null ||
      focusFrameRef.current !== null
    ) {
      return;
    }

    pendingFocusFieldRef.current = field;
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      const pendingField = pendingFocusFieldRef.current;
      pendingFocusFieldRef.current = null;
      if (!pendingField) return;

      const form = formRef.current;
      const fieldElement = form?.querySelector<RequiredFieldElement>(
        `[data-required-field="${pendingField}"]`
      );
      if (!fieldElement) return;

      fieldElement.focus({ preventScroll: true });

      const fieldWrapper =
        fieldElement.closest<HTMLElement>("[data-participant-field]") ??
        fieldElement;
      const fieldRect = fieldWrapper.getBoundingClientRect();
      const headerRect = document
        .querySelector<HTMLElement>("header")
        ?.getBoundingClientRect();
      const headerBottom = headerRect?.bottom ?? 0;
      const scrollTop = Math.max(
        0,
        window.scrollY +
          fieldRect.top -
          Math.max(0, headerBottom) -
          16
      );

      window.scrollTo({ top: scrollTop, behavior: "auto" });
    });
  };

  const handleInvalidCapture = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isRequiredFieldElement(event.target)) return;

    const requiredField = getRequiredField(event.target);
    if (!requiredField) return;

    const firstInvalidField = getFirstInvalidRequiredField(event.currentTarget);
    setRequiredErrors(getRequiredErrors(event.currentTarget));

    if (firstInvalidField === event.target) {
      scheduleFocus(requiredField);
    }
  };

  const handleBirthdayChange = (field: BirthdayField, value: string) => {
    const nextYear = field === "birthYear" ? value : birthYear;
    const nextMonth = field === "birthMonth" ? value : birthMonth;
    const nextDay = field === "birthDay" ? value : birthDay;

    if (field === "birthYear") setBirthYear(value);
    if (field === "birthMonth") setBirthMonth(value);
    if (field === "birthDay") setBirthDay(value);

    clearRequiredError(field, value);
    setBirthdayError(getBirthdayError(nextYear, nextMonth, nextDay));
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    if (!form.checkValidity()) {
      return;
    }

    const birthday =
      birthYear && birthMonth && birthDay
        ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`
        : "";

    // 生年月日の日付整合性チェック
    if (birthYear && birthMonth && birthDay && !isValidBirthday(birthYear, birthMonth, birthDay)) {
      setBirthdayError(BIRTHDAY_ERROR_MESSAGE);
      scheduleFocus("birthDay");
      return;
    }

    setBirthdayError(null);
    setLoading(true);

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
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onInvalidCapture={handleInvalidCapture}
            className="flex flex-col gap-5"
          >
            {/* 表示名 */}
            <div data-participant-field="name" className="flex flex-col gap-1">
              <Input
                id={REQUIRED_FIELD_IDS.name}
                label="表示名"
                icon={User}
                type="text"
                placeholder="山田 太郎"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearRequiredError("name", e.target.value);
                }}
                required
                data-required-field="name"
                aria-invalid={requiredErrors.name ? true : undefined}
                aria-describedby={getDescribedBy(requiredErrors, "name")}
                autoComplete="name"
              />
              {requiredErrors.name && (
                <p
                  id={REQUIRED_FIELD_ERROR_IDS.name}
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {requiredErrors.name}
                </p>
              )}
            </div>

            {/* 生年月日 */}
            <div
              data-participant-field="birthday"
              className="flex flex-col gap-1"
            >
              <label
                htmlFor={REQUIRED_FIELD_IDS.birthYear}
                className="text-sm font-medium text-text-dark"
              >
                生年月日 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <select
                    id={REQUIRED_FIELD_IDS.birthYear}
                    name="birthYear"
                    value={birthYear}
                    onChange={(e) =>
                      handleBirthdayChange("birthYear", e.target.value)
                    }
                    required
                    data-required-field="birthYear"
                    className={`${selectClass} w-full`}
                    aria-label="年"
                    aria-invalid={
                      requiredErrors.birthYear || birthdayError
                        ? true
                        : undefined
                    }
                    aria-describedby={getDescribedBy(
                      requiredErrors,
                      "birthYear",
                      birthdayError ? BIRTHDAY_ERROR_ID : undefined
                    )}
                  >
                    <option value="">年</option>
                    {YEARS.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}年
                      </option>
                    ))}
                  </select>
                  {requiredErrors.birthYear && (
                    <p
                      id={REQUIRED_FIELD_ERROR_IDS.birthYear}
                      role="alert"
                      className="text-xs text-red-600"
                    >
                      {requiredErrors.birthYear}
                    </p>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <select
                    id={REQUIRED_FIELD_IDS.birthMonth}
                    name="birthMonth"
                    value={birthMonth}
                    onChange={(e) =>
                      handleBirthdayChange("birthMonth", e.target.value)
                    }
                    required
                    data-required-field="birthMonth"
                    className={`${selectClass} w-full`}
                    aria-label="月"
                    aria-invalid={
                      requiredErrors.birthMonth || birthdayError
                        ? true
                        : undefined
                    }
                    aria-describedby={getDescribedBy(
                      requiredErrors,
                      "birthMonth",
                      birthdayError ? BIRTHDAY_ERROR_ID : undefined
                    )}
                  >
                    <option value="">月</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={String(m)}>
                        {m}月
                      </option>
                    ))}
                  </select>
                  {requiredErrors.birthMonth && (
                    <p
                      id={REQUIRED_FIELD_ERROR_IDS.birthMonth}
                      role="alert"
                      className="text-xs text-red-600"
                    >
                      {requiredErrors.birthMonth}
                    </p>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <select
                    id={REQUIRED_FIELD_IDS.birthDay}
                    name="birthDay"
                    value={birthDay}
                    onChange={(e) =>
                      handleBirthdayChange("birthDay", e.target.value)
                    }
                    required
                    data-required-field="birthDay"
                    className={`${selectClass} w-full`}
                    aria-label="日"
                    aria-invalid={
                      requiredErrors.birthDay || birthdayError
                        ? true
                        : undefined
                    }
                    aria-describedby={getDescribedBy(
                      requiredErrors,
                      "birthDay",
                      birthdayError ? BIRTHDAY_ERROR_ID : undefined
                    )}
                  >
                    <option value="">日</option>
                    {DAYS.map((d) => (
                      <option key={d} value={String(d)}>
                        {d}日
                      </option>
                    ))}
                  </select>
                  {requiredErrors.birthDay && (
                    <p
                      id={REQUIRED_FIELD_ERROR_IDS.birthDay}
                      role="alert"
                      className="text-xs text-red-600"
                    >
                      {requiredErrors.birthDay}
                    </p>
                  )}
                </div>
              </div>
              {birthdayError && (
                <p
                  id={BIRTHDAY_ERROR_ID}
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {birthdayError}
                </p>
              )}
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
            <div
              data-participant-field="region"
              className="flex flex-col gap-1"
            >
              <label
                htmlFor={REQUIRED_FIELD_IDS.region}
                className="text-sm font-medium text-text-dark"
              >
                お住まいの都道府県 <span className="text-red-500">*</span>
              </label>
              <select
                id={REQUIRED_FIELD_IDS.region}
                name="region"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  clearRequiredError("region", e.target.value);
                }}
                required
                data-required-field="region"
                className={selectClass}
                aria-label="都道府県"
                aria-invalid={requiredErrors.region ? true : undefined}
                aria-describedby={getDescribedBy(requiredErrors, "region")}
              >
                <option value="">選択してください</option>
                {PREFECTURES.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>
              {requiredErrors.region && (
                <p
                  id={REQUIRED_FIELD_ERROR_IDS.region}
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {requiredErrors.region}
                </p>
              )}
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
