import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listPendingBusinessReviews, reviewBusinessSubmission } from "@/lib/business-live.functions";
import { useAuthUser } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/business-reviews")({
  head: () => ({ meta: [
    { title: "Restaurant ownership moderation · JaanNee" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: BusinessReviews,
});

function BusinessReviews() {
  const { userId } = useAuthUser();
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string,string>>({});
  const pending = useQuery({
    queryKey: ["business-verification-queue", userId],
    queryFn: () => listPendingBusinessReviews(),
    enabled: Boolean(userId),
    retry: false,
  });
  const review = useMutation({
    mutationFn: (input: { businessId: string; approved: boolean }) =>
      reviewBusinessSubmission({
        data: { ...input, note: notes[input.businessId] || "" },
      }),
    onSuccess: async (_result, input) => {
      await qc.invalidateQueries({ queryKey: ["business-verification-queue"] });
      toast.success(input.approved ? "Business verified and linked to its new place" : "Business submission rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <AppShell tone="noir">
    <main className="mx-auto max-w-5xl space-y-6 pb-16">
      <header className="border-b border-white/10 pb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Administrator only</p>
        <h1 className="mt-3 font-display text-4xl uppercase sm:text-5xl">Restaurant verification</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Confirm a submitter's authority before granting an official restaurant identity.
          Verify contact information outside this tool. Reject duplicate or impersonated listings.
        </p>
        <Link to="/business" className="mt-3 inline-block text-sm underline underline-offset-4">Back to business workspace</Link>
      </header>
      {pending.isLoading ? <p className="text-sm text-muted-foreground">Loading the verification queue…</p> : null}
      {pending.isError ? <p role="alert" className="border border-primary/30 p-5 text-sm">
        Administrator access is required, or the database is currently unavailable.
      </p> : null}
      {pending.data?.length === 0 ? <p className="border border-border p-6 text-sm">No business submissions awaiting review.</p> : null}
      <div className="grid gap-4">
        {(pending.data ?? []).map((business: any) => <article key={business.id} className="space-y-4 border border-border p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{business.cuisine}</p>
              <h2 className="mt-1 font-display text-3xl">{business.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{business.area_label}</p>
            </div>
            <span className="inline-flex items-center gap-2 border border-amber-400/30 px-3 py-2 text-xs uppercase">
              <ShieldCheck size={16}/> Unverified
            </span>
          </div>
          <div className="bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide">Submitter-provided verification note (unverified)</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{business.verification_note}</p>
            <p className="mt-3 text-xs text-muted-foreground">Account identifier: {business.owner_id}</p>
          </div>
          <label className="block space-y-2"><span className="text-sm font-semibold">Review note</span>
            <Textarea rows={3} value={notes[business.id] || ""} maxLength={1000}
              onChange={(event) => setNotes((current) => ({ ...current, [business.id]: event.target.value }))}
              placeholder="Record the verification method or reason for rejection."/>
          </label>
          <p className="text-xs leading-6 text-muted-foreground">
            Approval creates an approved public place, an owner membership, and a verified official profile atomically.
            The public menu remains unpublished until the owner publishes it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={review.isPending || (notes[business.id] || "").trim().length < 10}
              onClick={() => {
                if (window.confirm("You personally verified this business and checked for duplicates?")) {
                  review.mutate({ businessId: business.id, approved: true });
                }
              }}><Check className="mr-2" size={16}/> Approve verified ownership</Button>
            <Button variant="outline" disabled={review.isPending || (notes[business.id] || "").trim().length < 10}
              onClick={() => review.mutate({ businessId: business.id, approved: false })}>
              <X className="mr-2" size={16}/> Reject submission
            </Button>
          </div>
        </article>)}
      </div>
    </main>
  </AppShell>;
}
