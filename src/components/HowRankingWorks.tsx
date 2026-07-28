import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useI18n } from "@/lib/i18n";
import { PUBLIC_RANK_THRESHOLD } from "@/lib/ranking";

/**
 * Compact trust explainer. States the real ranking rules — no marketing
 * claims and no invented metrics.
 */
export function HowRankingWorks({
  comparisonsCount,
  triedCount,
  className,
  variant = "ghost",
}: {
  comparisonsCount?: number | null;
  triedCount?: number | null;
  className?: string;
  variant?: "ghost" | "outline";
}) {
  const { t } = useI18n();
  const rules = [
    t("how_rule_tried"),
    t("how_rule_pool"),
    t("how_rule_no_pay"),
    t("how_rule_threshold"),
  ];

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="sm"
          className={`min-h-11 gap-2 text-xs font-semibold uppercase tracking-[0.08em] ${className ?? ""}`}
        >
          <Info className="h-4 w-4" aria-hidden="true" />
          {t("how_ranking_works")}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader className="text-left">
            <DrawerTitle>{t("how_ranking_works")}</DrawerTitle>
            <DrawerDescription>{t("tagline")}</DrawerDescription>
          </DrawerHeader>
          <ul className="space-y-3 px-4 pb-2">
            {rules.map((rule) => (
              <li key={rule} className="flex gap-3 text-sm leading-6 text-foreground">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden="true"
                />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          {comparisonsCount != null || triedCount != null ? (
            <dl className="mx-4 mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              {comparisonsCount != null ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {t("comparisons_progress")}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold">
                    {comparisonsCount}
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      / {PUBLIC_RANK_THRESHOLD}
                    </span>
                  </dd>
                </div>
              ) : null}
              {triedCount != null ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {t("tried_by")}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold">{triedCount}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="min-h-11">
                {t("close")}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
