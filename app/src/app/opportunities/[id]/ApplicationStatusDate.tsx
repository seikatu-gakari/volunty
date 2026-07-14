type ApplicationStatusDateProps = {
  label: "応募日" | "完了日";
  value: string;
};

export function ApplicationStatusDate({
  label,
  value,
}: ApplicationStatusDateProps) {
  return (
    <p className="text-xs text-text-body">
      {label}: {formatDateInJapan(value)}
    </p>
  );
}
import { formatDateInJapan } from "@/lib/date/format-date";
