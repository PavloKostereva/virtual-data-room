"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/keys";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/lib/validation";
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

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      apiRequest<{ ok: true; code?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: input,
      }),
  });
}

export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      apiRequest<{ ok: true }>("/api/auth/reset-password", { method: "POST", body: input }),
    onSuccess: () => {
      router.replace("/login?reset=1");
      router.refresh();
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiRequest<{ ok: true }>("/api/auth/change-password", { method: "POST", body: input }),
  });
}
