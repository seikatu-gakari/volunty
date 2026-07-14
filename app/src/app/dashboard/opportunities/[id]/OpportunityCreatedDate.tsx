import { formatDateInJapan } from "@/lib/date/format-date";

export function OpportunityCreatedDate({
  createdAt,
}: {
  createdAt: Date | string;
}) {
  return <span>作成日: {formatDateInJapan(createdAt)}</span>;
}
