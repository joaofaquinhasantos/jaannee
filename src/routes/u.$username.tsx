import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { DishCard } from "@/components/DishCard";
import { followUser, myFollowingIds, publicProfile } from "@/lib/dishes.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => {
    const url = `https://jaannee.lovable.app/u/${params.username}`;
    const title = `@${params.username} on JaanNee`;
    const desc = `See the dishes @${params.username} has tried, posted, and compared as a diner on JaanNee's dish-by-dish leaderboard.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            url,
            mainEntity: {
              "@type": "Person",
              name: params.username,
              alternateName: `@${params.username}`,
              url,
            },
          }),
        },
      ],
    };
  },
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { username } = Route.useParams();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => publicProfile({ data: { username } }),
  });
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s?.user);
      setUserId(s?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const following = useQuery({
    queryKey: ["following"],
    queryFn: () => myFollowingIds(),
    enabled: authed,
  });
  const followMut = useMutation({
    mutationFn: ({ targetId, follow }: { targetId: string; follow: boolean }) =>
      followUser({ data: { userId: targetId, follow } }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["following"] });
      qc.invalidateQueries({ queryKey: ["public-profile", username] });
      toast.success(
        vars.follow
          ? lang === "th"
            ? "กำลังติดตาม"
            : "Following"
          : lang === "th"
            ? "เลิกติดตามแล้ว"
            : "Unfollowed",
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading)
    return (
      <AppShell>
        <p className="text-muted-foreground">{t("loading")}</p>
      </AppShell>
    );
  if (!q.data) {
    return (
      <AppShell>
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="type-page-title">{lang === "th" ? "ไม่พบโปรไฟล์" : "Profile not found"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "th"
              ? "นักชิมคนนี้ยังไม่ได้ตั้งชื่อผู้ใช้สาธารณะ"
              : "This eater has not claimed a public username."}
          </p>
        </div>
      </AppShell>
    );
  }

  const profile = q.data.profile;
  const displayName = profile.display_name || profile.username;
  const tried = (q.data.tried ?? []).map((r: any) => r.dish).filter(Boolean);
  const isSelf = userId === profile.id;
  const isFollowing = (following.data ?? []).includes(profile.id);

  return (
    <AppShell>
      <section className="border-b border-border pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary font-display text-3xl text-primary-foreground">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                displayName.slice(0, 1)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-primary">@{profile.username}</p>
              <h1 className="type-page-title mt-1 truncate">{displayName}</h1>
              {profile.bio ? (
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">{profile.bio}</p>
              ) : null}
            </div>
          </div>
          {isSelf ? (
            <Link to="/profile">
              <Button variant="outline">{lang === "th" ? "แก้ไข" : "Edit"}</Button>
            </Link>
          ) : authed ? (
            <Button
              variant={isFollowing ? "secondary" : "default"}
              onClick={() => followMut.mutate({ targetId: profile.id, follow: !isFollowing })}
              disabled={followMut.isPending}
            >
              {isFollowing
                ? lang === "th"
                  ? "กำลังติดตาม"
                  : "Following"
                : lang === "th"
                  ? "ติดตาม"
                  : "Follow"}
            </Button>
          ) : (
            <Link to="/auth">
              <Button>{lang === "th" ? "เข้าสู่ระบบเพื่อติดตาม" : "Sign in to follow"}</Button>
            </Link>
          )}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-3 text-center">
          <Stat label={t("profile_tried")} value={tried.length} />
          <Stat label={t("profile_comparisons")} value={q.data.comparisons_count ?? 0} />
          <Stat label={lang === "th" ? "ผู้ติดตาม" : "Followers"} value={q.data.followers_count ?? 0} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="type-section-title mb-4">
          {lang === "th" ? "จานที่เคยกิน" : "Tried dishes"}
        </h2>
        {!profile.tried_public ? (
          <Empty
            text={
              lang === "th"
                ? "นักชิมคนนี้เก็บรายการจานที่เคยกินไว้เป็นส่วนตัว"
                : "This eater keeps tried dishes private."
            }
          />
        ) : tried.length === 0 ? (
          <Empty
            text={lang === "th" ? "ยังไม่มีจานที่เคยกินแบบสาธารณะ" : "No public tried dishes yet."}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tried.map((d: any) => (
              <DishCard key={d.id} dish={d} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
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

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
      {text}
    </div>
  );
}
