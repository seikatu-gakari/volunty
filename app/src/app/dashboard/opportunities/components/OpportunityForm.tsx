"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InvalidEvent,
} from "react";
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
import { ACTIVITY_STYLE_TAGS } from "@/lib/recommendations/activity-style-tags";

/** 選択できる活動スタイルタグの上限 */
const MAX_ACTIVITY_STYLE_TAGS = 3;

/** ブラウザ検証とサーバー検証で共通して扱うフィールド名 */
export type ValidationField =
  | "title"
  | "description"
  | "publishedAt"
  | "startDate"
  | "endDate"
  | "capacity"
  | "minAge"
  | "maxAge";

/** OpportunityForm の送信結果（予約日時のサーバー検証にも対応） */
export interface OpportunityFormActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<ValidationField, string>>;
}

type ValidationTarget =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement;
type FieldErrors = Partial<Record<ValidationField, string>>;
type PublishMode = "published" | "draft" | "scheduled";

const VALIDATION_FIELDS: readonly ValidationField[] = [
  "title",
  "description",
  "publishedAt",
  "startDate",
  "endDate",
  "capacity",
  "minAge",
  "maxAge",
];

const FIELD_ERROR_IDS: Record<ValidationField, string> = {
  title: "opportunity-title-error",
  description: "opportunity-description-error",
  publishedAt: "opportunity-publishedAt-error",
  startDate: "opportunity-startDate-error",
  endDate: "opportunity-endDate-error",
  capacity: "opportunity-capacity-error",
  minAge: "opportunity-minAge-error",
  maxAge: "opportunity-maxAge-error",
};

const REQUIRED_ERROR_MESSAGES: Partial<Record<ValidationField, string>> = {
  title: "案件タイトルを入力してください",
  description: "案件説明を入力してください",
  publishedAt: "公開予約日時を入力してください",
};

function isValidationTarget(value: unknown): value is ValidationTarget {
  if (
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement
  ) {
    return true;
  }

  if (!(value instanceof Element)) return false;
  return (
    value.tagName === "INPUT" ||
    value.tagName === "TEXTAREA" ||
    value.tagName === "SELECT"
  );
}

function isValidationField(value: string): value is ValidationField {
  for (const field of VALIDATION_FIELDS) {
    if (field === value) return true;
  }
  return false;
}

function getValidationField(name: string): ValidationField | null {
  return isValidationField(name) ? name : null;
}

function getValidationTargets(form: HTMLFormElement): ValidationTarget[] {
  return Array.from(
    form.querySelectorAll("input, textarea, select")
  ).filter(isValidationTarget);
}

function getValidationErrorMessage(
  field: ValidationField,
  element: ValidationTarget
): string {
  if (element.validity.valueMissing) {
    const requiredMessage = REQUIRED_ERROR_MESSAGES[field];
    if (requiredMessage) return requiredMessage;
  }

  return element.validationMessage || "入力内容を確認してください";
}

function collectInvalidFieldErrors(form: HTMLFormElement): {
  errors: FieldErrors;
  firstField: ValidationField | null;
} {
  const errors: FieldErrors = {};
  let firstField: ValidationField | null = null;

  for (const element of getValidationTargets(form)) {
    const field = getValidationField(element.name);
    if (!field || !element.willValidate || element.validity.valid) continue;

    firstField ??= field;
    if (errors[field] === undefined) {
      errors[field] = getValidationErrorMessage(field, element);
    }
  }

  return { errors, firstField };
}

function getFirstFieldWithError(
  form: HTMLFormElement | null,
  fieldErrors: FieldErrors
): ValidationField | null {
  if (!form) return null;

  for (const element of getValidationTargets(form)) {
    const field = getValidationField(element.name);
    if (field && fieldErrors[field]) return field;
  }

  return null;
}

function getFormField(
  form: HTMLFormElement | null,
  field: ValidationField
): ValidationTarget | null {
  if (!form) return null;
  return (
    getValidationTargets(form).find((element) => element.name === field) ?? null
  );
}

function getVisibleFieldErrors(
  fieldErrors: FieldErrors,
  publishMode: "published" | "draft" | "scheduled"
): FieldErrors {
  if (publishMode === "scheduled") return fieldErrors;

  if (fieldErrors.publishedAt === undefined) return fieldErrors;
  const visibleErrors = { ...fieldErrors };
  delete visibleErrors.publishedAt;
  return visibleErrors;
}

function getDescribedBy(
  existingIds: string | undefined,
  field: ValidationField,
  hasError: boolean
): string | undefined {
  const ids = existingIds?.split(/\s+/).filter(Boolean) ?? [];
  if (hasError) ids.push(FIELD_ERROR_IDS[field]);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** フォームの初期値 */
export interface OpportunityFormData {
  title: string;
  description: string;
  /** 活動スタイルタグID（最大3） */
  activity_style_tags?: string[];
  /** 必須資格 */
  required_qualifications?: string[];
  /** 対象年齢の下限 */
  min_age?: number | null;
  /** 対象年齢の上限 */
  max_age?: number | null;
  status?: OpportunityStatus;
  /** 活動場所 */
  location?: string | null;
  /** 開始日（YYYY-MM-DD） */
  start_date?: string | null;
  /** 終了日（YYYY-MM-DD） */
  end_date?: string | null;
  schedule?: string | null;
  /** 定員 */
  capacity?: number | null;
  /** カテゴリ */
  category?: string | null;
  /** 参加形態 */
  participation_mode?: ParticipationMode | null;
  cost?: string | null;
  belongings?: string | null;
  application_deadline?: string | null;
  cancellation_policy?: string | null;
  insurance_details?: string | null;
  contact_method?: string | null;
}

interface OpportunityFormProps {
  /** 編集モード時の初期データ */
  initialData?: OpportunityFormData;
  /** "create" = 新規作成、"edit" = 編集 */
  mode?: "create" | "edit";
  /** フォーム送信時の Server Action */
  onSubmitAction: (
    formData: FormData
  ) => Promise<OpportunityFormActionResult>;
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement | null>(null);
  const fieldContainersRef = useRef<
    Partial<Record<ValidationField, HTMLDivElement | null>>
  >({});
  const pendingFocusRef = useRef<ValidationField | null>(null);
  const focusFrameRef = useRef<number | null>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialData?.activity_style_tags ?? []
  );
  const [status, setStatus] = useState<OpportunityStatus>(
    initialData?.status ?? "published"
  );
  const [publishMode, setPublishMode] = useState<PublishMode>(
    initialData?.status === "draft" ? "draft" : "published"
  );

  const handlePublishModeChange = (value: PublishMode) => {
    setPublishMode(value);
    if (value === "scheduled") return;

    if (pendingFocusRef.current === "publishedAt") {
      pendingFocusRef.current = null;
    }
    setFieldErrors((previous) => {
      if (previous.publishedAt === undefined) return previous;
      const next = { ...previous };
      delete next.publishedAt;
      return next;
    });
  };

  useEffect(() => {
    if (pendingFocusRef.current === null || focusFrameRef.current !== null) {
      return;
    }

    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      const field = pendingFocusRef.current;
      pendingFocusRef.current = null;
      if (!field) return;

      const element = getFormField(formRef.current, field);
      const container = fieldContainersRef.current[field];
      if (!element || !container) return;

      element.focus({ preventScroll: true });
      container.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }, [fieldErrors]);

  useEffect(() => {
    return () => {
      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
      }
    };
  }, []);

  const handleInvalidCapture = (event: InvalidEvent<HTMLFormElement>) => {
    if (!isValidationTarget(event.target)) return;

    event.preventDefault();
    const invalidFields = collectInvalidFieldErrors(event.currentTarget);
    if (invalidFields.firstField === null) return;

    pendingFocusRef.current = invalidFields.firstField;
    setFieldErrors(invalidFields.errors);
  };

  const handleFieldChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const field = getValidationField(event.currentTarget.name);
    if (!field || !event.currentTarget.validity.valid) return;

    setFieldErrors((previous) => {
      if (previous[field] === undefined) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }
      if (prev.length >= MAX_ACTIVITY_STYLE_TAGS) {
        return prev;
      }
      return [...prev, tagId];
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const formData = new FormData(e.currentTarget);

      // 活動スタイルタグは state から送信する
      formData.delete("activityStyleTags");
      for (const tagId of selectedTags) {
        formData.append("activityStyleTags", tagId);
      }

      // 編集モード時はステータスを追加
      if (isEdit) {
        formData.set("status", status);
      }

      const result = await onSubmitAction(formData);
      if (!result.success) {
        const nextFieldErrors = getVisibleFieldErrors(
          result.fieldErrors ?? {},
          publishMode
        );
        pendingFocusRef.current = getFirstFieldWithError(
          formRef.current,
          nextFieldErrors
        );
        setFieldErrors(nextFieldErrors);
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
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onInvalidCapture={handleInvalidCapture}
          className="flex flex-col gap-6"
        >
          {/* 案件タイトル */}
          <div
            ref={(element) => {
              fieldContainersRef.current.title = element;
            }}
            data-validation-field="title"
            className="scroll-mt-24"
          >
            <Input
              label="案件タイトル"
              name="title"
              icon={FileText}
              type="text"
              placeholder="例: 環境保全ボランティア"
              defaultValue={initialData?.title ?? ""}
              required
              aria-invalid={fieldErrors.title !== undefined}
              aria-describedby={getDescribedBy(
                undefined,
                "title",
                fieldErrors.title !== undefined
              )}
              onChange={handleFieldChange}
            />
            {fieldErrors.title && (
              <p
                id={FIELD_ERROR_IDS.title}
                role="alert"
                className="mt-1 text-sm text-error"
              >
                {fieldErrors.title}
              </p>
            )}
          </div>

          {/* 案件説明 */}
          <div
            ref={(element) => {
              fieldContainersRef.current.description = element;
            }}
            data-validation-field="description"
            className="scroll-mt-24 flex flex-col gap-1"
          >
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
                aria-invalid={fieldErrors.description !== undefined}
                aria-describedby={getDescribedBy(
                  undefined,
                  "description",
                  fieldErrors.description !== undefined
                )}
                onChange={handleFieldChange}
              />
            </div>
            {fieldErrors.description && (
              <p
                id={FIELD_ERROR_IDS.description}
                role="alert"
                className="text-sm text-error"
              >
                {fieldErrors.description}
              </p>
            )}
          </div>

          <Input
            label="開催日時・頻度（任意）"
            name="schedule"
            icon={Calendar}
            type="text"
            placeholder="例: 毎週土曜日 10:00〜12:00"
            defaultValue={initialData?.schedule ?? ""}
          />

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
              <div
                ref={(element) => {
                  fieldContainersRef.current.startDate = element;
                }}
                data-validation-field="startDate"
                className="scroll-mt-24 flex flex-col gap-1"
              >
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
                    aria-invalid={fieldErrors.startDate !== undefined}
                    aria-describedby={getDescribedBy(
                      undefined,
                      "startDate",
                      fieldErrors.startDate !== undefined
                    )}
                    onChange={handleFieldChange}
                  />
                </div>
                {fieldErrors.startDate && (
                  <p
                    id={FIELD_ERROR_IDS.startDate}
                    role="alert"
                    className="text-sm text-error"
                  >
                    {fieldErrors.startDate}
                  </p>
                )}
              </div>
              <div
                ref={(element) => {
                  fieldContainersRef.current.endDate = element;
                }}
                data-validation-field="endDate"
                className="scroll-mt-24 flex flex-col gap-1"
              >
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
                    aria-invalid={fieldErrors.endDate !== undefined}
                    aria-describedby={getDescribedBy(
                      undefined,
                      "endDate",
                      fieldErrors.endDate !== undefined
                    )}
                    onChange={handleFieldChange}
                  />
                </div>
                {fieldErrors.endDate && (
                  <p
                    id={FIELD_ERROR_IDS.endDate}
                    role="alert"
                    className="text-sm text-error"
                  >
                    {fieldErrors.endDate}
                  </p>
                )}
              </div>
            </div>

            {/* 定員 */}
            <div
              ref={(element) => {
                fieldContainersRef.current.capacity = element;
              }}
              data-validation-field="capacity"
              className="scroll-mt-24"
            >
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
                aria-invalid={fieldErrors.capacity !== undefined}
                aria-describedby={getDescribedBy(
                  undefined,
                  "capacity",
                  fieldErrors.capacity !== undefined
                )}
                onChange={handleFieldChange}
              />
              {fieldErrors.capacity && (
                <p
                  id={FIELD_ERROR_IDS.capacity}
                  role="alert"
                  className="mt-1 text-sm text-error"
                >
                  {fieldErrors.capacity}
                </p>
              )}
            </div>

            {/* カテゴリ */}
            <Input label="費用（任意）" name="cost" icon={FileText} type="text" placeholder="例: 無料（交通費は自己負担）" defaultValue={initialData?.cost ?? ""} />
            <Input label="持ち物（任意）" name="belongings" icon={FileText} type="text" placeholder="例: 飲み物、軍手" defaultValue={initialData?.belongings ?? ""} />
            <div className="flex flex-col gap-1">
              <label htmlFor="applicationDeadline" className="text-sm font-medium text-text-dark">応募締切（任意）</label>
              <input id="applicationDeadline" name="applicationDeadline" type="date" defaultValue={initialData?.application_deadline ?? ""} className="rounded-lg border border-input-border bg-white px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            {([
              ["cancellationPolicy", "キャンセル方針（任意）", initialData?.cancellation_policy, "例: 前日までにVolunty内でご連絡ください"],
              ["insuranceDetails", "保険・安全情報（任意）", initialData?.insurance_details, "例: 主催者負担で行事保険に加入します"],
              ["contactMethod", "問い合わせ方法（任意）", initialData?.contact_method, "例: 応募後にVolunty内でご案内します"],
            ] as const).map(([name, label, value, placeholder]) => (
              <div key={name} className="flex flex-col gap-1">
                <label htmlFor={name} className="text-sm font-medium text-text-dark">{label}</label>
                <textarea id={name} name={name} rows={2} defaultValue={value ?? ""} placeholder={placeholder} className="rounded-lg border border-input-border bg-white px-3 py-2 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            ))}

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

          {!isEdit && (
            <div className="flex flex-col gap-3 rounded-lg border border-card-border bg-background/60 p-4">
              <span className="text-sm font-medium text-text-dark">
                公開方法
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["published", "すぐ公開"],
                  ["draft", "下書き保存"],
                  ["scheduled", "公開予約"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm text-text-body"
                  >
                    <input
                      type="radio"
                      name="publishMode"
                      value={value}
                      checked={publishMode === value}
                      onChange={() =>
                        handlePublishModeChange(value as PublishMode)
                      }
                      className="accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {publishMode === "scheduled" && (
                <div
                  ref={(element) => {
                    fieldContainersRef.current.publishedAt = element;
                  }}
                  data-validation-field="publishedAt"
                  className="scroll-mt-24"
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-body">公開日時</span>
                    <input
                      type="datetime-local"
                      name="publishedAt"
                      required
                      className="w-full rounded-lg border border-input-border bg-white px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
                      aria-invalid={fieldErrors.publishedAt !== undefined}
                      aria-describedby={getDescribedBy(
                        undefined,
                        "publishedAt",
                        fieldErrors.publishedAt !== undefined
                      )}
                      onChange={handleFieldChange}
                    />
                  </label>
                  {fieldErrors.publishedAt && (
                    <p
                      id={FIELD_ERROR_IDS.publishedAt}
                      role="alert"
                      className="mt-1 text-sm text-error"
                    >
                      {fieldErrors.publishedAt}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
                    value="draft"
                    checked={status === "draft"}
                    onChange={() => setStatus("draft")}
                    className="accent-primary"
                  />
                  下書き
                </label>
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

          {/* 活動スタイル */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <span className="text-sm font-medium text-text-dark">
                活動スタイル（任意・最大{MAX_ACTIVITY_STYLE_TAGS}つ）
              </span>
            </div>
            <p className="text-xs text-text-body">
              活動の進め方に近いものを選ぶと、傾向の合う参加者へのおすすめ順に反映されます。
              加点のみに使われ、参加者の応募が制限されることはありません。
            </p>
            <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-background/50 p-4">
              {ACTIVITY_STYLE_TAGS.map((tag) => {
                const checked = selectedTags.includes(tag.id);
                const disabled =
                  !checked && selectedTags.length >= MAX_ACTIVITY_STYLE_TAGS;
                return (
                  <label
                    key={tag.id}
                    className={`flex items-center gap-3 text-sm ${
                      disabled ? "text-text-body/40" : "text-text-dark"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => handleTagToggle(tag.id)}
                      className="size-4 accent-primary focus:ring-2 focus:ring-primary/50"
                    />
                    {tag.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* 参加要件 */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-text-dark">
              参加要件（任意）
            </span>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="requiredQualifications"
                className="text-xs text-text-body"
              >
                必須資格（1行に1つ）
              </label>
              <textarea
                id="requiredQualifications"
                name="requiredQualifications"
                rows={2}
                defaultValue={(initialData?.required_qualifications ?? []).join("\n")}
                placeholder="例: 普通自動車免許"
                className="w-full rounded-lg border border-input-border bg-white px-3 py-2 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div
                ref={(element) => {
                  fieldContainersRef.current.minAge = element;
                }}
                data-validation-field="minAge"
                className="scroll-mt-24"
              >
                <Input
                  label="対象年齢の下限（法令・安全上必要な場合のみ）"
                  name="minAge"
                  type="number"
                  min={0}
                  max={120}
                  placeholder="例: 18"
                  defaultValue={
                    initialData?.min_age != null ? String(initialData.min_age) : ""
                  }
                  aria-invalid={fieldErrors.minAge !== undefined}
                  aria-describedby={getDescribedBy(
                    undefined,
                    "minAge",
                    fieldErrors.minAge !== undefined
                  )}
                  onChange={handleFieldChange}
                />
                {fieldErrors.minAge && (
                  <p
                    id={FIELD_ERROR_IDS.minAge}
                    role="alert"
                    className="mt-1 text-sm text-error"
                  >
                    {fieldErrors.minAge}
                  </p>
                )}
              </div>
              <div
                ref={(element) => {
                  fieldContainersRef.current.maxAge = element;
                }}
                data-validation-field="maxAge"
                className="scroll-mt-24"
              >
                <Input
                  label="対象年齢の上限（法令・安全上必要な場合のみ）"
                  name="maxAge"
                  type="number"
                  min={0}
                  max={120}
                  placeholder="例: 65"
                  defaultValue={
                    initialData?.max_age != null ? String(initialData.max_age) : ""
                  }
                  aria-invalid={fieldErrors.maxAge !== undefined}
                  aria-describedby={getDescribedBy(
                    undefined,
                    "maxAge",
                    fieldErrors.maxAge !== undefined
                  )}
                  onChange={handleFieldChange}
                />
                {fieldErrors.maxAge && (
                  <p
                    id={FIELD_ERROR_IDS.maxAge}
                    role="alert"
                    className="mt-1 text-sm text-error"
                  >
                    {fieldErrors.maxAge}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* エラーメッセージ */}
          {error && (
            <p className="text-center text-sm text-error">{error}</p>
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
