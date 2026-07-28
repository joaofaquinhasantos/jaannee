import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPendingMs: 0,
    defaultPendingMinMs: 200,
    defaultPendingComponent: () => (
      <div
        className="min-h-screen bg-background px-5 py-20 text-sm text-muted-foreground"
        role="status"
        aria-label="Loading page"
      >
        <div className="mx-auto h-1 w-24 animate-pulse bg-primary" />
      </div>
    ),
    defaultPreload: "intent",
    defaultPreloadDelay: 100,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
