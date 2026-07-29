import type { ReactNode } from "react";
import { AlertTriangle, Check, LoaderCircle, Plus } from "lucide-react";

export function StitchState({
  kind,
  eyebrow,
  title,
  body,
  action,
}: {
  kind: "empty" | "loading" | "error" | "success";
  eyebrow?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const Icon =
    kind === "loading"
      ? LoaderCircle
      : kind === "error"
        ? AlertTriangle
        : kind === "success"
          ? Check
          : Plus;

  return (
    <section
      className={`stitch-state stitch-state-${kind}`}
      aria-live={kind === "loading" ? "polite" : undefined}
    >
      <div className="stitch-state-mark" aria-hidden="true">
        <Icon className={kind === "loading" ? "animate-spin" : undefined} />
      </div>
      {eyebrow ? <p className="stitch-kicker">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {action ? <div className="stitch-state-actions">{action}</div> : null}
    </section>
  );
}

