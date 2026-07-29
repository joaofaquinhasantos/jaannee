import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getRestaurantContactPermission,
  setRestaurantContactPermission,
} from "@/lib/restaurant.functions";
import { useI18n } from "@/lib/i18n";
import { useAuthUser } from "@/lib/use-auth";

export function RestaurantConnection({
  placeId,
  placeName,
  dishId,
  eligible,
}: {
  placeId?: string | null;
  placeName?: string | null;
  dishId: string;
  eligible: boolean;
}) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const auth = useAuthUser();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["restaurant-permission", auth.userId, placeId],
    queryFn: () => getRestaurantContactPermission({ data: { placeId: placeId! } }),
    enabled: auth.status === "in" && eligible && Boolean(placeId),
  });
  const mutation = useMutation({
    mutationFn: (next: { allowMessages: boolean; allowVouchers: boolean }) =>
      setRestaurantContactPermission({
        data: {
          placeId: placeId!,
          sourceDishId: dishId,
          ...next,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-permission", auth.userId, placeId] });
      toast.success(copy("Restaurant contact preference saved", "บันทึกการอนุญาตให้ร้านติดต่อแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!eligible || !placeId || q.isLoading || q.data?.available === false) return null;
  const permission = q.data?.permission;
  const connected =
    permission && !permission.revoked_at && (permission.allow_messages || permission.allow_vouchers);

  return (
    <section className="mt-6 rounded-lg border border-border bg-secondary/35 p-4 md:p-5">
      <p className="label-caps text-primary">
        {copy("Optional restaurant connection", "การเชื่อมต่อกับร้าน (ไม่บังคับ)")}
      </p>
      <h2 className="mt-2 font-display text-2xl">
        {copy(`Hear from ${placeName || "this restaurant"}?`, `รับข่าวจาก ${placeName || "ร้านนี้"} หรือไม่`)}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {copy(
          "Your Tried or Want to try mark stays private unless you choose to connect. Permission never affects rankings, and you can revoke it anytime.",
          "สถานะเคยกินหรืออยากลองจะยังเป็นส่วนตัว เว้นแต่คุณเลือกเชื่อมต่อ การอนุญาตนี้ไม่มีผลต่ออันดับและยกเลิกได้ทุกเมื่อ",
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={permission?.allow_messages && !permission?.revoked_at ? "default" : "outline"}
          className="min-h-11 gap-2"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              allowMessages: !(permission?.allow_messages && !permission?.revoked_at),
              allowVouchers: Boolean(permission?.allow_vouchers && !permission?.revoked_at),
            })
          }
        >
          <MessageCircle size={16} />
          {copy("Allow occasional messages", "อนุญาตข้อความเป็นครั้งคราว")}
        </Button>
        <Button
          type="button"
          variant={permission?.allow_vouchers && !permission?.revoked_at ? "default" : "outline"}
          className="min-h-11 gap-2"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              allowMessages: Boolean(permission?.allow_messages && !permission?.revoked_at),
              allowVouchers: !(permission?.allow_vouchers && !permission?.revoked_at),
            })
          }
        >
          <Gift size={16} />
          {copy("Allow gift vouchers", "อนุญาตบัตรกำนัล")}
        </Button>
        {connected ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ allowMessages: false, allowVouchers: false })}
          >
            {copy("Disconnect restaurant", "ยกเลิกการเชื่อมต่อ")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
