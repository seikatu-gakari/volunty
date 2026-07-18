import type { ReactNode } from "react";

export type PaperStageVariant = "hero" | "journey" | "styles" | "trust";

const BACKDROP_CLASS_NAMES: Record<PaperStageVariant, string> = {
  hero: "lp-paper-stage--hero",
  journey: "lp-paper-stage--journey",
  styles: "lp-paper-stage--styles",
  trust: "lp-paper-stage--trust",
};

interface LPPaperStageProps {
  variant: PaperStageVariant;
  children: ReactNode;
}

export function LPPaperStage({ variant, children }: LPPaperStageProps) {
  return (
    <div
      className="relative isolate overflow-hidden bg-lp-cream"
      data-testid="lp-paper-stage"
      data-variant={variant}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 lp-paper-stage__backdrop ${BACKDROP_CLASS_NAMES[variant]}`}
        data-testid="lp-paper-backdrop"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
