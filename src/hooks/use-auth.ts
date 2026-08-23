"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/keys";
import type { LoginInput, RegisterInput } from "@/lib/validation";
import type { UserDto } from "@/types/dto";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiRequest<{ user: UserDto | null }>("/api/auth/me").then((data) => data.user),
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiRequest<{ user: UserDto }>("/api/auth/login", { method: "POST", body: input }),
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(queryKeys.me, user);
      router.replace("/rooms");
      router.refresh();
    },
  });
}

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiRequest<{ user: UserDto }>("/api/auth/register", { method: "POST", body: input }),
    onSuccess: () => {
      router.replace("/login?registered=1");
      router.refresh();
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiRequest<void>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });
}
