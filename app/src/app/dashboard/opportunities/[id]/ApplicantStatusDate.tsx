import { formatDateInJapan } from "@/lib/date/format-date";

export function ApplicantStatusDate({
  label,
  value,
}: {
  label: "応募日" | "完了日";
  value: Date | string;
}) {
  return (
    <>
      {label}: {formatDateInJapan(value)}
    </>
  );
}
