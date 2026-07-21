import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitComparison } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export function InlineTriedCompare({ dish, other }: { dish: any; other: any }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (winnerId: string) =>
      submitComparison({ data: { dishAId: dish.id, dishBId: other.id, winnerId } }),
    onSuccess: () => {
      toast.success(t("comparison_saved"));
      qc.invalidateQueries({ queryKey: ["dish", dish.id] });
      qc.invalidateQueries({ queryKey: ["tried"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const otherName = lang === "th" && other.name_th ? other.name_th : other.name_en;
  return (
    <section className="mt-4 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-semibold text-muted-foreground">
        {t("youve_tried_too")} {otherName} {t("which_was_better")}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InlineWinnerButton dish={dish} disabled={mut.isPending} onPick={() => mut.mutate(dish.id)} />
        <InlineWinnerButton dish={other} disabled={mut.isPending} onPick={() => mut.mutate(other.id)} />
      </div>
    </section>
  );
}

function InlineWinnerButton({ dish, disabled, onPick }: { dish: any; disabled?: boolean; onPick: () => void }) {
  const { lang } = useI18n();
  const name = lang === "th" && dish.name_th ? dish.name_th : dish.name_en;
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className="overflow-hidden rounded-lg border border-border bg-background text-left transition-colors hover:border-primary/40 disabled:opacity-60"
    >
      <div className="aspect-[4/3] bg-muted">
        {dish.photo_url ? (
          <img src={dish.photo_url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary font-display text-3xl italic text-muted-foreground">JaanNee</div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-display text-2xl leading-none">{name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{dish.place?.name}</p>
      </div>
    </button>
  );
}
