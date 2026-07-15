import { formatDateInJapan } from "@/lib/date/format-date";

type OpportunityPublicationDateProps = {
  createdAt: string;
};

export function OpportunityPublicationDate({
  createdAt,
}: OpportunityPublicationDateProps) {
  return (
    <p className="text-sm text-text-body">
      掲載日: {formatDateInJapan(createdAt)}
    </p>
  );
}
