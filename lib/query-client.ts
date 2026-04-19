import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Resolve the Express API base URL. Resolution order:
 *   1. EXPO_PUBLIC_API_URL — full URL incl. scheme + port. Set this for
 *      local dev: EXPO_PUBLIC_API_URL=http://localhost:5000
 *   2. EXPO_PUBLIC_DOMAIN — bare host or full URL. Used for prod / static
 *      deploys where the API is served over HTTPS at a known domain.
 *   3. http://localhost:5000 — matches the PORT in .env.example.
 *
 * The Express server defaults to PORT 3000 when no env is set, but the
 * project's .env pins PORT=5000 — historically a Replit convention that
 * survived the F1 provider abstraction. The fallback here matches the
 * actual configured port, not the server's stale default.
 */
export function getApiUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) return apiUrl.endsWith("/") ? apiUrl : apiUrl + "/";

  const host = process.env.EXPO_PUBLIC_DOMAIN;
  if (host) {
    const withScheme = /^https?:\/\//i.test(host) ? host : `https://${host}`;
    return new URL(withScheme).href;
  }

  return "http://localhost:5000/";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url.toString(), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url.toString(), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
