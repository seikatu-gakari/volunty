const MISSING_DATE_ERROR = "公開予約日時を入力してください";
const INVALID_DATE_ERROR = "公開予約日時の形式が正しくありません";
const PAST_DATE_ERROR = "公開予約日時は現在より後の日時を指定してください";

const JST_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;
const SCHEDULED_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export type ScheduledPublicationResult =
  | { success: true; publishedAt: string }
  | { success: false; error: string };

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function formatJstDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** datetime-local の入力をJSTとして検証し、UTCのISO日時へ変換する。 */
export function parseScheduledPublication(
  value: FormDataEntryValue | null,
  now: Date,
): ScheduledPublicationResult {
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return { success: false, error: MISSING_DATE_ERROR };
  }

  if (typeof value !== "string") {
    return { success: false, error: INVALID_DATE_ERROR };
  }

  const match = SCHEDULED_DATE_PATTERN.exec(value);
  if (!match) {
    return { success: false, error: INVALID_DATE_ERROR };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59
  ) {
    return { success: false, error: INVALID_DATE_ERROR };
  }

  // 入力値にJSTのoffsetを明示し、offsetなしのDate文字列は解釈しない。
  const scheduledAt = new Date(`${value}:00+09:00`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { success: false, error: INVALID_DATE_ERROR };
  }

  // UTCへ変換した後にJSTへ戻し、Dateによる自動補正がないことを確認する。
  const roundTrippedValue = formatJstDate(
    new Date(scheduledAt.getTime() + JST_OFFSET_MILLISECONDS),
  );
  if (roundTrippedValue !== value) {
    return { success: false, error: INVALID_DATE_ERROR };
  }

  if (scheduledAt.getTime() <= now.getTime()) {
    return { success: false, error: PAST_DATE_ERROR };
  }

  return { success: true, publishedAt: scheduledAt.toISOString() };
}
