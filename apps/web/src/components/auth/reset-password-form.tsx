"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Client-side schema includes confirmPassword for UX.
// Match the backend's resetPasswordConfirmSchema (min 6, no complexity).
const resetFormSchema = z
  .object({
    password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type ResetFormData = z.infer<typeof resetFormSchema>;

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ResetFormData>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: ResetFormData) {
    if (!token) {
      toast.error(t("errors.invalidOrExpiredToken"));
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/password-reset/confirm", {
        token,
        password: data.password,
      });
      toast.success(t("success.passwordReset"));
      router.push(`/${locale}/login`);
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 429) {
        toast.error(t("errors.rateLimited"));
      } else {
        toast.error(t("errors.invalidOrExpiredToken"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive">
          {t("errors.invalidOrExpiredToken")}
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("labels.newPassword")}</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="********"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("labels.confirmPassword")}</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder="********"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full gradient-primary text-white"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("buttons.resetPassword")
          )}
        </Button>
      </form>
    </Form>
  );
}
