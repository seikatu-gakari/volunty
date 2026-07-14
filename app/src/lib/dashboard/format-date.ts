export function formatDateInJapan(value: Date | string): string {
  const normalizedValue =
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
      ? `${value}Z`
      : value;

  return new Date(normalizedValue).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
}
