import { useId } from "react";

interface Props {
  hours: number;
  minutes: number;
  onChange: (next: { hours: number; minutes: number }) => void;
  maxHours?: number;
  className?: string;
  disabled?: boolean;
}

/** Two-field Hours : Minutes input. Hours 0–maxHours, Minutes 0–59. */
export function HoursMinutesInput({ hours, minutes, onChange, maxHours = 24, className, disabled }: Props) {
  const id = useId();
  function setH(v: string) {
    const n = Math.max(0, Math.min(maxHours, Math.floor(Number(v) || 0)));
    onChange({ hours: n, minutes });
  }
  function setM(v: string) {
    const n = Math.max(0, Math.min(59, Math.floor(Number(v) || 0)));
    onChange({ hours, minutes: n });
  }
  const baseInput =
    "w-full rounded-xl border border-border bg-surface/60 px-3 py-3 text-center text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-ring";
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="flex-1">
        <input
          id={`${id}-h`}
          type="number"
          inputMode="numeric"
          min={0}
          max={maxHours}
          step={1}
          value={Number.isFinite(hours) ? hours : 0}
          onChange={(e) => setH(e.target.value)}
          disabled={disabled}
          aria-label="Hours"
          className={baseInput}
        />
        <p className="mt-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground">Hours</p>
      </div>
      <span className="pb-5 text-lg font-semibold text-muted-foreground">:</span>
      <div className="flex-1">
        <input
          id={`${id}-m`}
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          step={1}
          value={Number.isFinite(minutes) ? minutes : 0}
          onChange={(e) => setM(e.target.value)}
          disabled={disabled}
          aria-label="Minutes"
          className={baseInput}
        />
        <p className="mt-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground">Minutes</p>
      </div>
    </div>
  );
}

export function totalMinutes(hours: number, minutes: number): number {
  return Math.max(0, Math.floor(hours) * 60 + Math.floor(minutes));
}

export function fromMinutes(total: number): { hours: number; minutes: number } {
  const t = Math.max(0, Math.floor(total || 0));
  return { hours: Math.floor(t / 60), minutes: t % 60 };
}
