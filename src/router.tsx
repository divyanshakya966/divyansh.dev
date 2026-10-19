import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getStartContext } from "@tanstack/start-storage-context";
import { routeTree } from "./routeTree.gen";

const CSP_NONCE_HEADER = "x-csp-nonce";

// server-only: the client reads the nonce from the <meta csp-nonce> tag during
// hydration, so its branch resolves to undefined and the server-only import is
// stripped from the client bundle (importing it there crashes on `async_hooks`).
const readCspNonce = createIsomorphicFn()
  .client((): string | undefined => undefined)
  .server((): string | undefined => {
    try {
      return (
        getStartContext({ throwIfNotFound: false })?.request.headers.get(CSP_NONCE_HEADER) ??
        undefined
      );
    } catch {
      return undefined;
    }
  });

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
