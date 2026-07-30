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
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
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

  const options = dishes.filter((dish) => dish.photo_url).slice(0, 6);
  if (dismissed || auth.status === "in" || options.length < 2) return null;

  const close = () => {
    dismissActivation();
    setDismissed(true);
  };

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#0d0d0d] px-4 py-10 text-white md:px-8 md:py-14">
      <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative mx-auto max-w-[112rem]">
        <div className="flex items-start justify-between gap-5">
          <div className="max-w-4xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
              {copy("Start with your taste", "เริ่มจากรสนิยมของคุณ")}
            </p>
            <h2 className="mt-3 font-noir-display text-5xl uppercase leading-[0.86] sm:text-6xl md:text-7xl">
              {t("activation_title")}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              {t("activation_body")}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("dismiss")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/60 hover:border-white/40 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="-mx-4 mt-7 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:px-0 lg:grid-cols-6">
          {options.map((dish) => {
            const active = selected.includes(dish.id);
            const name = localizedName(dish, lang);
            return (
              <button
                key={dish.id}
                type="button"
                onClick={() => setSelected(togglePendingTried(dish.id))}
                aria-pressed={active}
                className={`relative w-[46vw] max-w-[210px] shrink-0 snap-start overflow-hidden border text-left transition md:w-auto md:max-w-none ${
                  active
                    ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-[#0d0d0d]"
                    : "border-white/15 hover:border-white/40"
                }`}
              >
                <div className="aspect-[4/5] bg-black">
                  <img
                    src={dish.photo_url ?? ""}
                    alt={name}
                    width={320}
                    height={320}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-h-20 border-t border-white/10 bg-[#171717] p-3">
                  <p className="line-clamp-2 font-display text-lg uppercase leading-5">{name}</p>
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

        <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <Button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/?activate=1" } })}
            disabled={selected.length === 0 || applying}
            className="min-h-12 w-full px-6 sm:w-auto"
          >
            {applying ? t("saving") : t("activation_save")}
          </Button>
          <div>
            <p className="text-xs font-bold text-white/80">
              {selected.length} {t("selected_count")}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {copy(
                "Nothing is saved until you sign in. Your selections will still be here when you return.",
                "ระบบจะยังไม่บันทึกจนกว่าคุณจะเข้าสู่ระบบ รายการที่เลือกจะยังอยู่เมื่อคุณกลับมา",
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
