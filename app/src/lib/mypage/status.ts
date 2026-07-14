import type { ApplicationStatus } from "./types";

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "審査中",
  approved: "マッチング成立",
  rejected: "辞退済み",
  completed: "活動完了",
};

export function applicationStatusLabel(status: ApplicationStatus): string {
  return APPLICATION_STATUS_LABELS[status];
}
