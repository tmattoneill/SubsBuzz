import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { EmailCategory } from "@/lib/types";

const KEY = ["/api/email-categories"];

export function useCategories() {
  return useQuery<EmailCategory[]>({
    queryKey: KEY,
    queryFn: () => api.get<EmailCategory[]>("/api/email-categories"),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string | null; sortOrder?: number }) =>
      api.post<EmailCategory>("/api/email-categories", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; color?: string | null; sortOrder?: number }) =>
      api.patch<EmailCategory>(`/api/email-categories/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<null>(`/api/email-categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["/api/monitored-emails"] });
    },
  });
}
