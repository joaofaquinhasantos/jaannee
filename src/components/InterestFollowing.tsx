import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellPlus, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listMyInterestFollows, toggleInterestFollow } from "@/lib/dishes.functions";
import { useAuthUser } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";

export type InterestFollows = {
  category_ids: string[];
  area_ids: string[];
  available: boolean;
};

export function useInterestFollows() {
  const auth = useAuthUser();
  const query = useQuery({
    queryKey: ["interest-follows", auth.userId],
    queryFn: () => listMyInterestFollows(),
    enabled: auth.status === "in",
    staleTime: 60_000,
  });
  return {
    auth,
    query,
    follows: (query.data ?? {
      category_ids: [],
      area_ids: [],
      available: true,
    }) as InterestFollows,
  };
}

export function InterestFollowControls({
  category,
  area,
}: {
  category?: { id: string; name_en?: string | null; name_th?: string | null } | null;
  area?: { id?: string; name_en?: string | null; name_th?: string | null } | null;
}) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const qc = useQueryClient();
  const { auth, follows } = useInterestFollows();
  const mutation = useMutation({
    mutationFn: (input: { kind: "category" | "area"; targetId: string; follow: boolean }) =>
      toggleInterestFollow({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interest-follows", auth.userId] }),
    onError: (error: Error) =>
      toast.error(
        error.message.includes("does not exist")
          ? copy("Interest following is not available yet.", "ยังไม่สามารถติดตามความสนใจได้")
          : error.message,
      ),
  });

  if (auth.status !== "in" || (!category && !area) || follows.available === false) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {category ? (
        <FollowButton
          label={lang === "th" ? category.name_th || category.name_en : category.name_en}
          followed={follows.category_ids.includes(category.id)}
          pending={mutation.isPending}
          onToggle={(follow) =>
            mutation.mutate({ kind: "category", targetId: category.id, follow })
          }
        />
      ) : null}
      {area?.id ? (
        <FollowButton
          label={lang === "th" ? area.name_th || area.name_en : area.name_en}
          followed={follows.area_ids.includes(area.id)}
          pending={mutation.isPending}
          onToggle={(follow) => mutation.mutate({ kind: "area", targetId: area.id!, follow })}
        />
      ) : null}
    </div>
  );
}

function FollowButton({
  label,
  followed,
  pending,
  onToggle,
}: {
  label?: string | null;
  followed: boolean;
  pending: boolean;
  onToggle: (follow: boolean) => void;
}) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  return (
    <Button
      type="button"
      size="sm"
      variant={followed ? "default" : "outline"}
      disabled={pending}
      onClick={() => onToggle(!followed)}
      className="min-h-9 rounded-full"
    >
      {followed ? (
        <BellRing className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <BellPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      )}
      {followed
        ? copy(`Following ${label ?? ""}`, `กำลังติดตาม ${label ?? ""}`)
        : copy(`Follow ${label ?? ""}`, `ติดตาม ${label ?? ""}`)}
    </Button>
  );
}
