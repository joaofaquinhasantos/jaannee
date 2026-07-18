import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — JaanNee" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/" }); });
  }, [navigate]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  const signInGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-semibold">{t("sign_in")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">We'll email you a magic link — no password needed.</p>
        {sent ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-sm text-muted-foreground">Open the link on this device to finish signing in.</p>
          </div>
        ) : (
          <form onSubmit={send} className="mt-6 space-y-3">
            <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Email me a link"}
            </Button>
          </form>
        )}
        {!sent && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={googleLoading}
              onClick={signInGoogle}
            >
              {googleLoading ? "Opening Google…" : "Continue with Google"}
            </Button>
          </>
        )}
      </div>
    </AppShell>
  );
}