import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Grid3X3, Utensils } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { followUser, myFollowingIds, publicProfile } from "@/lib/dishes.functions";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/u/$username")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(publicProfileQuery(params.username)),
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

function publicProfileQuery(username: string) {
  return queryOptions({
    queryKey: ["public-profile", username],
    queryFn: () => publicProfile({ data: { username } }),
    staleTime: 60_000,
  });
}

function PublicProfilePage() {
  const { username } = Route.useParams();
  const { lang, t } = useI18n();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"posts" | "tried">("posts");
  const q = useQuery(publicProfileQuery(username));
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session?.user);
      setUserId(data.session?.user?.id ?? null);
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
      toast.success(vars.follow ? "Following" : "Unfollowed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading)
    return (
      <AppShell>
        <p className="text-muted-foreground">Loading...</p>
      </AppShell>
    );
  if (!q.data) {
    return (
      <AppShell>
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="type-page-title">Profile not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This eater has not claimed a public username.
          </p>
        </div>
      </AppShell>
    );
  }

  const profile = q.data.profile;
  const displayName = profile.display_name || profile.username;
  const posted = q.data.posted ?? [];
  const tried = (q.data.tried ?? []).map((r: any) => r.dish).filter(Boolean);
  const isSelf = userId === profile.id;
  const isFollowing = (following.data ?? []).includes(profile.id);

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary font-display text-3xl text-primary-foreground sm:h-28 sm:w-28 sm:text-5xl">
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
              <h1 className="mt-1 truncate font-display text-3xl leading-none sm:text-5xl">
                {displayName}
              </h1>
              {profile.bio ? (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {profile.bio}
                </p>
              ) : null}
            </div>
          </div>
          {isSelf ? (
            <Link to="/profile">
              <Button variant="outline">Edit</Button>
            </Link>
          ) : authed ? (
            <Button
              variant={isFollowing ? "secondary" : "default"}
              onClick={() => followMut.mutate({ targetId: profile.id, follow: !isFollowing })}
              disabled={followMut.isPending}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
          ) : (
            <Link to="/auth">
              <Button>Sign in to follow</Button>
            </Link>
          )}
        </div>
        <div className="mt-6 grid grid-cols-4 border-y border-border py-4 text-center">
          <Stat label={t("profile_posts")} value={posted.length} />
          <Stat label={t("profile_tried")} value={tried.length} />
          <Stat label={t("profile_comparisons")} value={q.data.comparisons_count ?? 0} />
          <Stat label={lang === "th" ? "ผู้ติดตาม" : "Followers"} value={q.data.followers_count ?? 0} />
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-5xl">
        <div className="grid grid-cols-2 border-b border-border" role="tablist">
          <ProfileTab
            active={activeTab === "posts"}
            label={t("profile_posts")}
            icon={<Grid3X3 className="h-4 w-4" />}
            onClick={() => setActiveTab("posts")}
          />
          <ProfileTab
            active={activeTab === "tried"}
            label={t("profile_tried")}
            icon={<Utensils className="h-4 w-4" />}
            onClick={() => setActiveTab("tried")}
          />
        </div>

        <div className="mt-1">
          {activeTab === "posts" ? (
            <ProfileDishGrid
              dishes={posted}
              lang={lang}
              emptyText={lang === "th" ? "ยังไม่มีโพสต์" : "No posts yet."}
            />
          ) : !profile.tried_public ? (
            <Empty
              text={
                lang === "th"
                  ? "นักชิมคนนี้ตั้งค่ารายการที่เคยกินเป็นส่วนตัว"
                  : "This diner keeps tried dishes private."
              }
            />
          ) : (
            <ProfileDishGrid
              dishes={tried}
              lang={lang}
              emptyText={lang === "th" ? "ยังไม่มีจานที่เคยกินแบบสาธารณะ" : "No public tried dishes yet."}
            />
          )}
        </div>
      </section>
    </AppShell>
  );
}

function ProfileTab({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center gap-2 border-b-2 text-xs font-bold uppercase tracking-wide transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProfileDishGrid({
  dishes,
  lang,
  emptyText,
}: {
  dishes: any[];
  lang: "en" | "th";
  emptyText: string;
}) {
  if (dishes.length === 0) return <Empty text={emptyText} />;

  return (
    <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
      {dishes.map((dish) => {
        const name = lang === "th" && dish.name_th ? dish.name_th : dish.name_en;
        return (
          <Link
            key={dish.id}
            to="/dish/$id"
            params={{ id: dish.id }}
            aria-label={name}
            className="group relative aspect-square overflow-hidden bg-card focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {dish.photo_url ? (
              <img
                src={dish.photo_url}
                alt={name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center font-display text-lg">
                {name}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <p className="truncate text-xs font-bold text-white sm:text-sm">{name}</p>
              {dish.place?.name ? (
                <p className="truncate text-[10px] text-white/75 sm:text-xs">{dish.place.name}</p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
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
