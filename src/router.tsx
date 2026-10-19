import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { getStartContext } from "@tanstack/start-storage-context";
import { routeTree } from "./routeTree.gen";

const CSP_NONCE_HEADER = "x-csp-nonce";

function readCspNonce(): string | undefined {
  try {
    return (
      getStartContext({ throwIfNotFound: false })?.request.headers.get(CSP_NONCE_HEADER) ??
      undefined
    );
  } catch {
    return undefined;
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ssr: { nonce: readCspNonce() },
  });

  return router;
};
