export type UrgencyTier = "comfortable" | "approaching" | "urgent" | "overdue";

export interface UrgencyInfo {
  tier: UrgencyTier;
  daysRemaining: number;
  color: string;
}

export const URGENCY_COLORS: Record<UrgencyTier, string> = {
  comfortable: "#4caf50",
  approaching: "#ff9800",
  urgent: "#d32f2f",
  overdue: "#b71c1c",
};

export function getUrgency(
  dueDate: string | null,
  status: string,
  today?: Date,
): UrgencyInfo | null {
  if (dueDate == null) return null;
  if (status === "done" || status === "deleted") return null;

  const dueMs = new Date(dueDate + "T00:00:00").getTime();
  if (isNaN(dueMs)) return null;

  const now = today ?? new Date();
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  const daysRemaining = Math.floor((dueMs - todayMidnight) / 86_400_000);

  let tier: UrgencyTier;
  if (daysRemaining < 0) {
    tier = "overdue";
  } else if (daysRemaining === 0) {
    tier = "urgent";
  } else if (daysRemaining <= 3) {
    tier = "approaching";
  } else {
    tier = "comfortable";
  }

  return { tier, daysRemaining, color: URGENCY_COLORS[tier] };
}

export function formatOverdueText(daysRemaining: number): string | null {
  if (daysRemaining >= 0) return null;
  const abs = Math.abs(daysRemaining);
  return abs === 1 ? "+1 day" : `+${abs} days`;
}
