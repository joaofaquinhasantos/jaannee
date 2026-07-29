import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { ReadyToComparePanel } from "@/components/ContextualCompare";
import { Button } from "@/components/ui/button";
import { toggleTried } from "@/lib/dishes.functions";
import {
  clearPendingTried,
  dismissActivation,
  isActivationDismissed,
  readPendingTried,
  togglePendingTried,
} from "@/lib/activation";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";
import { useAuthUser } from "@/lib/use-auth";

type ActivationDish = {
  id: string;
  name_en?: string | null;
  name_th?: string | null;
  photo_url?: string | null;
  place?: { name?: string | null } | null;
};

export function TriedActivation({ dishes }: { dishes: ActivationDish[] }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const auth = useAuthUser();
  const applyingRef = useRef(false);
  const mountedRef = useRef(true);
  const [selected, setSelected] = useState<string[]>(() => readPendingTried());
  const [dismissed, setDismissed] = useState(() => isActivationDismissed());
  const [applying, setApplying] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (auth.status !== "in" || selected.length === 0 || applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    const pendingIds = [...selected];
    Promise.all(pendingIds.map((dishId) => toggleTried({ data: { dishId, tried: true } })))
      .then(async () => {
        clearPendingTried();
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["tried"] }),
          qc.invalidateQueries({ queryKey: ["tried-ids"] }),
          qc.invalidateQueries({ queryKey: ["profile"] }),
        ]);
        if (!mountedRef.current) return;
        setSelected([]);
        setShowComparison(true);
        toast.success(t("activation_saved"));
      })
      .catch((error: Error) => {
        if (mountedRef.current) toast.error(error.message);
      })
      .finally(() => {
        applyingRef.current = false;
        if (mountedRef.current) setApplying(false);
      });
  }, [auth.status, qc, selected, t]);

  if (showComparison && auth.status === "in") {
    return (
      <section className="border-b border-white/10 bg-[#171717] px-4 py-6 md:px-8">
        <ReadyToComparePanel />
      </section>
    );
  }

  const options = dishes.filter((dish) => dish.photo_url).slice(0, 8);
  if (dismissed || auth.status === "in" || options.length < 2) return null;

  const close = () => {
    dismissActivation();
    setDismissed(true);
  };

  return (
    <section className="border-b border-white/10 bg-[#171717] px-4 py-6 text-white md:px-8 md:py-8">
      <div className="mx-auto max-w-[90rem]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              {t("activation_title")}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              {t("activation_body")}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("dismiss")}
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 text-white/60 hover:border-white/40 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {options.map((dish) => {
            const active = selected.includes(dish.id);
            const name = localizedName(dish, lang);
            return (
              <button
                key={dish.id}
                type="button"
                onClick={() => setSelected(togglePendingTried(dish.id))}
                aria-pressed={active}
                className={`relative overflow-hidden border text-left transition ${
                  active
                    ? "border-primary ring-2 ring-primary"
                    : "border-white/15 hover:border-white/40"
                }`}
              >
                <div className="aspect-square bg-black">
                  <img
                    src={dish.photo_url ?? ""}
                    alt={name}
                    width={320}
                    height={320}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-h-16 bg-black/85 p-2">
                  <p className="line-clamp-2 text-xs font-semibold leading-4">{name}</p>
                  {dish.place?.name ? (
                    <p className="mt-1 truncate text-[10px] text-white/75">{dish.place.name}</p>
                  ) : null}
                </div>
                {active ? (
                  <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/?activate=1" } })}
            disabled={selected.length === 0 || applying}
            className="min-h-11"
          >
            {applying ? t("saving") : t("activation_save")}
          </Button>
          <span className="text-xs text-white/75">
            {selected.length} {t("selected_count")}
          </span>
        </div>
      </div>
    </section>
  );
}
