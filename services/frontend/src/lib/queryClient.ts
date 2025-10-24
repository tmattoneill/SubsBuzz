import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { api, ApiError } from "./api-client";

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  try {
    switch (method.toLowerCase()) {
      case 'post':
        return await api.post(url, data);
      case 'put':
        return await api.put(url, data);
      case 'patch':
        return await api.patch(url, data);
      case 'delete':
        return await api.delete(url);
      default:
        return await api.get(url);
    }
  } catch (error) {
    const apiError = error as ApiError;
    throw new Error(`${apiError.status || 500}: ${apiError.message}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      // Construct URL from queryKey parts
      // If queryKey has multiple parts, join them with '/'
      // e.g., ["/api/digest/date", "2025-10-24"] => "/api/digest/date/2025-10-24"
      const url = queryKey.length > 1
        ? `${queryKey[0]}/${queryKey.slice(1).join('/')}`
        : queryKey[0] as string;

      return await api.get<T>(url);
    } catch (error) {
      const apiError = error as ApiError;

      if (unauthorizedBehavior === "returnNull" && apiError.status === 401) {
        return null as T;
      }

      throw apiError;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes (renamed to gcTime in newer versions)
      retry: (failureCount, error) => {
        const apiError = error as ApiError;
        // Don't retry on 4xx errors (client errors)
        if (apiError.status && apiError.status >= 400 && apiError.status < 500) {
          return false;
        }
        // Retry up to 3 times for server errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        const apiError = error as ApiError;
        // Don't retry on 4xx errors
        if (apiError.status && apiError.status >= 400 && apiError.status < 500) {
          return false;
        }
        // Retry once for server errors
        return failureCount < 1;
      },
      retryDelay: 1000,
    },
  },
});
