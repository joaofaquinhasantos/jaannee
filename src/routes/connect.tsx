import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Bot, Copy, Check, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connect an AI assistant — JaanNee" },
      {
        name: "description",
        content:
          "Connect ChatGPT or Claude to JaanNee via MCP and explore Thailand's best dishes with an AI assistant.",
      },
      {
        property: "og:title",
        content: "Connect an AI assistant — JaanNee",
      },
      {
        property: "og:description",
        content:
          "Connect ChatGPT or Claude to JaanNee via MCP and explore Thailand's best dishes with an AI assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "twitter:title",
        content: "Connect an AI assistant — JaanNee",
      },
      {
        name: "twitter:description",
        content:
          "Connect ChatGPT or Claude to JaanNee via MCP and explore Thailand's best dishes with an AI assistant.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://jaannee.lovable.app/connect" },
    ],
  }),
  component: Connect,
});

function Connect() {
  const [mcpUrl, setMcpUrl] = useState<string>("https://jaannee.lovable.app/mcp");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMcpUrl(new URL("/mcp", window.location.origin).toString());
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy MCP URL:", err);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl py-6 md:py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Bot className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl">
            Connect an AI assistant
          </h1>
          <p className="mt-3 text-muted-foreground">
            Use JaanNee with ChatGPT or Claude to discover dishes, read
            rankings, and look up plates.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
          <label className="text-sm font-bold uppercase text-muted-foreground">
            MCP server URL
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={mcpUrl}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button onClick={handleCopy} variant="outline" className="gap-2">
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <InstructionCard
            title="ChatGPT"
            steps={[
              "Open ChatGPT Settings → Connectors → Advanced and enable Developer mode.",
              "In the chat composer, turn on Developer mode.",
              "Click Add sources, then Connect more.",
              "Name the connector and paste the MCP URL above.",
              "Start a new chat and ask ChatGPT about JaanNee dishes.",
            ]}
            href="https://chatgpt.com/#settings/Connectors/Advanced"
          />
          <InstructionCard
            title="Claude"
            steps={[
              "Open Claude's custom connectors page.",
              "Name the connector and paste the MCP URL above.",
              "Enable the connector from the chat composer.",
              "Start a new chat and ask Claude about JaanNee dishes.",
            ]}
            href="https://claude.ai/customize/connectors?modal=add-custom-connector"
          />
        </div>

        <div className="mt-8 rounded-xl border border-border bg-secondary/50 p-5 md:p-6">
          <h2 className="font-display text-2xl">Refresh after the app changes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Connected assistants cache the tool list. After JaanNee ships an
            update, refresh the connector to get the latest tools.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">ChatGPT</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>
                  Open ChatGPT's app preferences and pick JaanNee under Enabled
                  apps.
                </li>
                <li>Next to Information, click Refresh.</li>
                <li>If the URL changed, paste the latest URL from above.</li>
                <li>Start a new chat and ask ChatGPT to use JaanNee.</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold">Claude</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>Open the Connectors page and select the JaanNee connector.</li>
                <li>Refresh or update the connector's tools.</li>
                <li>If the URL changed, paste the latest URL from above.</li>
                <li>Ask Claude to use JaanNee.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function InstructionCard({
  title,
  steps,
  href,
}: {
  title: string;
  steps: string[];
  href: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">{title}</h2>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="sr-only">Open {title} settings</span>
        </a>
      </div>
      <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
