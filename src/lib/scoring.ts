// FocusFlow scoring , pure functions, shared client+server.

export type Category =
  | "learning" | "work" | "fitness" | "wellness"
  | "entertainment" | "personal" | "social" | "sleep" | "other";

export interface ActivityRow {
  name: string;
  category: Category;
  score: number;          // -10..+10
  duration_minutes: number;
  activity_date: string;  // YYYY-MM-DD
}

const PRODUCTIVE: Category[] = ["learning", "work"];
const FOCUS: Category[] = ["learning", "work"];
const WELLNESS: Category[] = ["fitness", "wellness"];
const DISTRACTION_THRESHOLD = -2;

export interface MetricBreakdown {
  productivity: number;   // 0-100
  consistency: number;    // 0-100
  focus: number;          // 0-100
  wellness: number;       // 0-100
  learning: number;       // 0-100
  distraction: number;    // 0-100 (higher = more distracted)
  focusFlowScore: number; // 0-100 weighted
  // Raw breakdowns:
  learningMin: number;
  deepWorkMin: number;
  fitnessMin: number;
  wellnessMin: number;
  entertainmentMin: number;
  personalMin: number;
  socialMin: number;
  sleepMin: number;
  otherMin: number;
  distractionMin: number;
  totalMin: number;
}

export function computeMetrics(rows: ActivityRow[], windowDays = 7): MetricBreakdown {
  const totalMin = sum(rows.map(r => r.duration_minutes));
  if (rows.length === 0 || totalMin === 0) {
    return {
      productivity: 0, consistency: 0, focus: 0, wellness: 0, learning: 0,
      distraction: 0, focusFlowScore: 0,
      learningMin: 0, deepWorkMin: 0, fitnessMin: 0, wellnessMin: 0,
      entertainmentMin: 0, personalMin: 0, socialMin: 0, sleepMin: 0, otherMin: 0,
      distractionMin: 0, totalMin: 0,
    };
  }
  const learningMin = sumBy(rows, r => r.category === "learning");
  const deepWorkMin = sumBy(rows, r => r.category === "work" && r.score >= 7);
  const fitnessMin = sumBy(rows, r => r.category === "fitness");
  const wellnessMin = sumBy(rows, r => r.category === "wellness");
  const entertainmentMin = sumBy(rows, r => r.category === "entertainment");
  const distractionMin = sumBy(rows, r => r.score <= DISTRACTION_THRESHOLD);
  const personalMin = sumBy(rows, r => r.category === "personal");
  const socialMin = sumBy(rows, r => r.category === "social");
  const sleepMin = sumBy(rows, r => r.category === "sleep");
  const otherMin = sumBy(rows, r => r.category === "other");
  const productiveMin = sumBy(rows, r => PRODUCTIVE.includes(r.category) && r.score > 0);
  const focusMin = sumBy(rows, r => FOCUS.includes(r.category) && r.score >= 7);
  const wellnessAll = sumBy(rows, r => WELLNESS.includes(r.category));

  // Productivity: ratio of weighted-positive minutes to total. No baseline.
  const weightedPositive = sum(rows.filter(r => r.score > 0).map(r => r.duration_minutes * (r.score / 10)));
  const weightedNegative = sum(rows.filter(r => r.score < 0).map(r => r.duration_minutes * (Math.abs(r.score) / 10)));
  const productivity = clamp(((weightedPositive - 0.5 * weightedNegative) / Math.max(totalMin, 60)) * 100, 0, 100);

  // Consistency: how many of the last N days had productive activity
  const daysWithProductive = new Set(rows.filter(r => r.score >= 5).map(r => r.activity_date)).size;
  const consistency = clamp((daysWithProductive / windowDays) * 100, 0, 100);

  // Focus: deep work share. No baseline bonus.
  const focusDenominator = productiveMin + distractionMin;
  const focus = focusDenominator > 0
    ? clamp((focusMin / focusDenominator) * 100, 0, 100)
    : 0;

  // Wellness: target ~60 min/day of fitness+wellness across window
  const wellness = clamp((wellnessAll / (windowDays * 60)) * 100, 0, 100);

  // Learning
  const learning = clamp((learningMin / (windowDays * 90)) * 100, 0, 100);

  // Distraction: scale 0-100
  const distraction = clamp((distractionMin / (windowDays * 60)) * 100, 0, 100);

  // FocusFlow = 0.4P + 0.3C + 0.2F + 0.1W, minus distraction penalty
  const base = 0.4 * productivity + 0.3 * consistency + 0.2 * focus + 0.1 * wellness;
  const focusFlowScore = clamp(base - distraction * 0.15, 0, 100);

  return {
    productivity: round(productivity),
    consistency: round(consistency),
    focus: round(focus),
    wellness: round(wellness),
    learning: round(learning),
    distraction: round(distraction),
    focusFlowScore: round(focusFlowScore),
    learningMin, deepWorkMin, fitnessMin, wellnessMin, entertainmentMin,
    personalMin, socialMin, sleepMin, otherMin, distractionMin, totalMin,
  };
}

export function derivePersona(m: MetricBreakdown): { name: string; reason: string } {
  if (m.focusFlowScore >= 75 && m.consistency >= 70) return { name: "Consistent Grinder", reason: "High FocusFlow score and steady daily output." };
  if (m.focus >= 70 && m.learning >= 60) return { name: "Deep Learner", reason: "Long uninterrupted study sessions dominate your week." };
  if (m.deepWorkMin >= 600 && m.focus >= 60) return { name: "Focused Builder", reason: "You ship , most of your time is deep building work." };
  if (m.distraction >= 50 && m.productivity >= 50) return { name: "Distracted Achiever", reason: "You get things done but lose hours to scrolling." };
  if (m.totalMin >= 10 * 60 * 7 && m.wellness < 20) return { name: "Burnout Risk", reason: "High output, almost zero recovery time." };
  if (m.productivity >= 55 && m.wellness >= 40) return { name: "Balanced Performer", reason: "Productive, but you protect your recovery." };
  return { name: "Finding your rhythm", reason: "Log a few more days to unlock a clearer persona." };
}

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  learning:      { label: "Learning",      color: "var(--chart-1)" },
  work:          { label: "Deep Work",     color: "var(--chart-2)" },
  fitness:       { label: "Fitness",       color: "var(--chart-3)" },
  wellness:      { label: "Wellness",      color: "var(--chart-4)" },
  entertainment: { label: "Entertainment", color: "var(--chart-5)" },
  personal:      { label: "Personal",      color: "var(--muted-foreground)" },
  social:        { label: "Social",        color: "var(--info)" },
  sleep:         { label: "Sleep",         color: "var(--muted-foreground)" },
  other:         { label: "Other",         color: "var(--muted-foreground)" },
};

function sum(xs: number[]) { return xs.reduce((a, b) => a + b, 0); }
function sumBy(rows: ActivityRow[], pred: (r: ActivityRow) => boolean) {
  return sum(rows.filter(pred).map(r => r.duration_minutes));
}
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function round(n: number) { return Math.round(n); }
