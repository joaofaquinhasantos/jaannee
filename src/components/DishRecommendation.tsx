import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { myDishRecommendation, setDishRecommendation } from "@/lib/recommendations.functions";
import { useI18n } from "@/lib/i18n";

export function DishRecommendation({
  dishId,
  isTried,
  isApproved,
  isSignedIn,
}: {
  dishId: string;
  isTried: boolean;
  isApproved: boolean;
  isSignedIn: boolean;
}) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => lang === "th" ? th : en;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const query = useQuery({
    queryKey: ["my-dish-recommendation", dishId],
    queryFn: () => myDishRecommendation({ data: { dishId } }),
    enabled: isSignedIn && isApproved,
    staleTime: 30_000,
  });
  const recommended = Boolean(query.data);
  useEffect(() => {
    if (!open) setNote(query.data?.note ?? "");
  }, [open, query.data?.note]);

  const mutation = useMutation({
    mutationFn: (isRecommended: boolean) =>
      setDishRecommendation({
        data: { dishId, recommended: isRecommended, note: isRecommended ? note.trim() : undefined },
      }),
    onSuccess: async (_result, isRecommended) => {
      setOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-dish-recommendation", dishId] }),
        qc.invalidateQueries({ queryKey: ["following-picks"] }),
        qc.invalidateQueries({ queryKey: ["public-picks"] }),
      ]);
      toast.success(isRecommended
        ? copy("Your public recommendation is saved", "บันทึกคำแนะนำสาธารณะแล้ว")
        : copy("Recommendation withdrawn", "ยกเลิกคำแนะนำแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isApproved || !isSignedIn || !isTried) return null;
  return (
    <>
      <Button
        type="button"
        variant={recommended ? "secondary" : "outline"}
        className="min-h-11 gap-2"
        onClick={() => {
          setNote(query.data?.note ?? "");
          setOpen(true);
        }}
        disabled={query.isLoading || query.isError || mutation.isPending}
      >
        <Heart size={16} fill={recommended ? "currentColor" : "none"} aria-hidden="true" />
        {recommended
          ? copy("Your pick · Edit", "จานแนะนำของคุณ · แก้ไข")
          : copy("Recommend this dish", "แนะนำจานนี้")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{copy("Your public pick", "จานที่คุณแนะนำต่อสาธารณะ")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-6 text-muted-foreground">
            {copy(
              "Only recommend dishes you have eaten and would genuinely suggest to someone else. Your pick and note appear on your public profile, and people who follow you can discover them. This never changes JaanNee's community rankings.",
              "แนะนำเฉพาะจานที่เคยกินและอยากบอกต่อ คำแนะนำและข้อความของคุณจะแสดงบนโปรไฟล์สาธารณะและให้ผู้ติดตามเห็น โดยไม่เปลี่ยนอันดับรวม",
            )}
          </p>
          <label className="block space-y-2 text-sm font-semibold">
            <span>{copy("Why do you recommend it? (optional)", "ทำไมถึงอยากแนะนำ? (ไม่บังคับ)")}</span>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 180))}
              maxLength={180}
              rows={3}
              placeholder={copy("One detail worth knowing…", "เหตุผลที่อยากบอกต่อ…")}
            />
            <span className="block text-right text-xs font-normal text-muted-foreground">
              {note.length}/180
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            {copy("A public username is required.", "ต้องมีชื่อผู้ใช้สาธารณะ")}
            {" "}
            <Link to="/profile" className="underline underline-offset-2 hover:text-primary" onClick={() => setOpen(false)}>
              {copy("Edit profile", "แก้ไขโปรไฟล์")}
            </Link>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>
              {recommended ? copy("Save pick", "บันทึกจานแนะนำ") : copy("Recommend publicly", "แนะนำต่อสาธารณะ")}
            </Button>
            {recommended ? (
              <Button type="button" variant="outline" onClick={() => mutation.mutate(false)} disabled={mutation.isPending}>
                {copy("Remove my pick", "ลบคำแนะนำ")}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
