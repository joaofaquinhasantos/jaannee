import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { DishCard } from "@/components/DishCard";
import { ReadyToComparePanel } from "@/components/ContextualCompare";
import { RetentionSuite } from "@/components/RetentionSuite";
import { PostActivity, PostProgressTimeline } from "@/components/PostActivity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { myProfile, updateMyProfile } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";
import { buildPhotoPath, PHOTO_ACCEPT_ATTR, validatePhotoFile } from "@/lib/photo-upload";
import { useAuthUser } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Your JaanNee profile" }, { name: "robots", content: "noindex, follow" }],
  }),
  component: Profile,
});

function Profile() {
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { userId } = useAuthUser();
  const q = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => myProfile(),
    enabled: Boolean(userId),
  });
  const tried = (q.data?.tried ?? []).map((row: { dish?: unknown }) => row.dish).filter(Boolean);
  const wantToTry = (q.data?.want_to_try ?? [])
    .map((row: { dish?: unknown }) => row.dish)
    .filter(Boolean);
  const compared = q.data?.compared ?? [];
  const posted = q.data?.posted ?? [];
  const profile = q.data?.profile;
  const hasDisplayName = Boolean(profile?.display_name?.trim());
  const displayName =
    profile?.display_name || profile?.username || copy("Your profile", "โปรไฟล์ของคุณ");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bio, setBio] = useState("");
  const [triedPublic, setTriedPublic] = useState(true);
  const [profileSection, setProfileSection] = useState<
    "tried" | "submissions" | "settings"
  >("tried");

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setName(profile.display_name ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
    setBio(profile.bio ?? "");
    setTriedPublic(profile.tried_public !== false);
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: () =>
      updateMyProfile({
        data: {
          username,
          displayName: name,
          avatarUrl,
          bio,
          triedPublic,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(copy("Profile saved", "บันทึกโปรไฟล์แล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/", replace: true });
  };

  const uploadAvatar = async (file: File) => {
    if (!userId) return;
    setAvatarUploading(true);
    try {
      validatePhotoFile(file);
      const path = buildPhotoPath(userId, file).replace(`${userId}/`, `${userId}/profile/`);
      const { error } = await supabase.storage
        .from("dish-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      setAvatarUrl(`/photos/${path}`);
      toast.success(
        copy(
          "Photo ready. Save your profile to publish it.",
          "รูปพร้อมแล้ว บันทึกโปรไฟล์เพื่อเผยแพร่",
        ),
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const invalidUsername = username.trim().length > 0 && username.trim().length < 3;

  return (
    <AppShell tone="noir">
      <div className="stitch-profile">
      <section className="stitch-profile-hero relative overflow-hidden border-b border-white/10 bg-[#1c1b1b] p-5 md:p-10">
        <div className="stitch-profile-identity flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4 md:gap-12">
            <div className="stitch-profile-avatar flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-primary font-display text-4xl md:text-6xl">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                displayName.slice(0, 1)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-primary">{t("my_jaannee")}</p>
              <h1
                className={
                  hasDisplayName
                    ? "mt-2 break-words font-display text-[clamp(2.5rem,7vw,6rem)] leading-[0.9]"
                    : "mt-2 break-all text-3xl font-semibold leading-tight md:text-5xl"
                }
              >
                {hasDisplayName ? displayName : profile?.username ? `@${displayName}` : displayName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("profile_history_body")}</p>
              {profile?.bio ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">{profile.bio}</p>
              ) : null}
            </div>
          </div>
          <p className="stitch-profile-vertical" aria-hidden="true">
            Bangkok taste / JaanNee
          </p>
          <Button variant="ghost" onClick={signOut} className="min-h-11">
            {t("sign_out")}
          </Button>
        </div>
      </section>

      <div className="stitch-profile-stats grid grid-cols-4 border-b border-white/10 bg-[#181717] py-5 text-center">
        <Stat label={t("profile_posts")} value={posted.length} />
        <Stat label={t("profile_tried")} value={tried.length} />
        <Stat label={t("profile_comparisons")} value={compared.length} />
        <Stat label={copy("Followers", "ผู้ติดตาม")} value={q.data?.followers_count ?? 0} />
      </div>

      <nav className="stitch-profile-tabs" aria-label={copy("Profile sections", "ส่วนต่าง ๆ ของโปรไฟล์")}>
        {[
          ["tried", t("profile_tried")],
          ["submissions", t("profile_submitted")],
          ["settings", t("profile_settings")],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              setProfileSection(value as "tried" | "submissions" | "settings")
            }
            className={profileSection === value ? "is-active" : undefined}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className={profileSection === "tried" ? "block" : "hidden"}>
      <RetentionSuite
        counts={{
          posted: posted.length,
          tried: tried.length,
          compared: compared.length,
          saved: wantToTry,
        }}
      />

      <div className="mt-6">
        <ReadyToComparePanel />
      </div>

      </div>

      <div className={profileSection === "submissions" ? "stitch-section" : "hidden"}>
        <PostActivity dishes={posted} />
      </div>

      <section className={profileSection === "tried" ? "stitch-dashboard-card mt-8" : "hidden"}>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          {copy("Plan your next meal", "วางแผนมื้อต่อไป")}
        </p>
        <h2 className="type-section-title mt-2">{t("want_to_try")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("want_to_try_body")}
        </p>
        {wantToTry.length === 0 ? (
          <div className="mt-5">
            <EmptyNote text={t("no_saved_dishes")} />
          </div>
        ) : (
          <div className="stitch-photo-grid mt-5">
            {wantToTry.map((dish: any) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
        )}
      </section>

      <section className={profileSection === "tried" ? "mt-8" : "hidden"}>
        <h2 className="type-section-title mb-4">{t("profile_tried")}</h2>
        {tried.length === 0 ? (
          <EmptyNote
            text={copy("No dishes marked tried yet.", "ยังไม่มีจานที่ทำเครื่องหมายว่าเคยกิน")}
          />
        ) : (
          <div className="stitch-photo-grid">
            {tried.map((dish: any) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
        )}
      </section>

      <section className={profileSection === "submissions" ? "mt-10" : "hidden"}>
        <h2 className="type-section-title mb-4">{t("profile_submitted")}</h2>
        {posted.length === 0 ? (
          <EmptyNote text={copy("No submitted dishes yet.", "ยังไม่มีจานที่ส่งไว้")} />
        ) : (
          <div className="stitch-photo-grid">
            {posted.map((dish: any) =>
              dish.status === "approved" ? (
                <div
                  key={dish.id}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  <DishCard dish={dish} />
                  <div className="border-t border-border px-4 pb-4">
                    <PostProgressTimeline dish={dish} />
                  </div>
                </div>
              ) : (
                <PrivateSubmissionCard key={dish.id} dish={dish} />
              ),
            )}
          </div>
        )}
      </section>

      <section className={profileSection === "tried" ? "mt-10" : "hidden"}>
        <h2 className="type-section-title mb-4">{t("profile_comparisons")}</h2>
        {compared.length === 0 ? (
          <EmptyNote text={copy("No comparisons yet.", "ยังไม่มีการเปรียบเทียบ")} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {compared.map((comparison: any) => (
              <li
                key={comparison.id}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 text-sm"
              >
                <ComparisonDish
                  dish={comparison.lo}
                  winner={comparison.winner_id === comparison.lo?.id}
                />
                <span className="text-xs font-bold uppercase text-muted-foreground">VS</span>
                <ComparisonDish
                  dish={comparison.hi}
                  winner={comparison.winner_id === comparison.hi?.id}
                  align="right"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={profileSection === "settings" ? "stitch-dashboard-card mt-10" : "hidden"}>
        <h2 className="type-section-title">{t("profile_settings")}</h2>
        {!profile?.username ? (
          <div className="mt-4 rounded-md bg-secondary p-3 text-sm">
            {copy(
              "Claim a username to make your public profile visible. Until then, it remains private.",
              "ตั้งชื่อผู้ใช้เพื่อเปิดโปรไฟล์สาธารณะ จนกว่าจะตั้ง โปรไฟล์จะยังเป็นส่วนตัว",
            )}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">
            <span>{copy("Username", "ชื่อผู้ใช้")}</span>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              placeholder="joao_eats"
              aria-invalid={invalidUsername}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>{copy("Name", "ชื่อ")}</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="md:col-span-2">
            <p className="text-sm font-semibold">{copy("Profile photo", "รูปโปรไฟล์")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-background/40 p-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-primary font-display text-3xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  displayName.slice(0, 1)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">
                  {copy(
                    "Choose a JPEG, PNG, or WebP image up to 8 MB.",
                    "เลือกรูป JPEG, PNG หรือ WebP ขนาดไม่เกิน 8 MB",
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    {avatarUploading
                      ? copy("Uploading…", "กำลังอัปโหลด…")
                      : copy(
                          avatarUrl ? "Change photo" : "Add photo",
                          avatarUrl ? "เปลี่ยนรูป" : "เพิ่มรูป",
                        )}
                    <input
                      type="file"
                      accept={PHOTO_ACCEPT_ATTR}
                      className="sr-only"
                      disabled={avatarUploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void uploadAvatar(file);
                      }}
                    />
                  </label>
                  {avatarUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 gap-2"
                      disabled={avatarUploading}
                      onClick={() => setAvatarUrl("")}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {copy("Remove", "ลบ")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <label className="space-y-1 text-sm font-semibold md:col-span-2">
            <span>{copy("Bio", "แนะนำตัว")}</span>
            <Textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={160}
            />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border p-3 text-sm font-semibold md:col-span-2">
            <span>
              {copy("Show dishes I tried on my public profile", "แสดงจานที่เคยกินในโปรไฟล์สาธารณะ")}
            </span>
            <input
              type="checkbox"
              checked={triedPublic}
              onChange={(event) => setTriedPublic(event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => saveProfile.mutate()}
            disabled={saveProfile.isPending || invalidUsername}
            className="min-h-11"
          >
            {copy("Save profile", "บันทึกโปรไฟล์")}
          </Button>
          {profile?.username ? (
            <Link to="/u/$username" params={{ username: profile.username }}>
              <Button variant="outline" className="min-h-11">
                {copy("View public profile", "ดูโปรไฟล์สาธารณะ")}
              </Button>
            </Link>
          ) : null}
        </div>
      </section>
      </div>
    </AppShell>
  );
}

function PrivateSubmissionCard({ dish }: { dish: any }) {
  const { lang, t } = useI18n();
  const name = localizedName(dish, lang);
  const pending = dish.status === "pending";
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="aspect-[4/3] bg-muted">
        {dish.photo_url ? (
          <img
            src={dish.photo_url}
            alt={name}
            width={800}
            height={600}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary">
          {pending ? t("pending_review") : t("not_approved")}
        </p>
        <h3 className="mt-2 font-display text-2xl">{name}</h3>
        {dish.place?.name ? (
          <p className="mt-1 text-sm text-muted-foreground">{dish.place.name}</p>
        ) : null}
        <PostProgressTimeline dish={dish} />
      </div>
    </article>
  );
}

function ComparisonDish({
  dish,
  winner,
  align = "left",
}: {
  dish: any;
  winner: boolean;
  align?: "left" | "right";
}) {
  const { lang } = useI18n();
  return (
    <span
      className={`${winner ? "font-semibold" : "text-muted-foreground"} ${align === "right" ? "text-right" : ""}`}
    >
      {localizedName(dish, lang)}
      {dish?.place?.name ? (
        <span className="block text-xs font-normal text-muted-foreground">{dish.place.name}</span>
      ) : null}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="type-stat">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
      {text}
    </div>
  );
}
