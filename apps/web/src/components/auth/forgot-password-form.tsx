"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordRequestSchema,
  type ResetPasswordRequestInput,
} from "@comicstrunk/contracts";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ResetPasswordRequestInput>({
    resolver: zodResolver(resetPasswordRequestSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ResetPasswordRequestInput) {
    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/password-reset/request", data);
      setIsSubmitted(true);
      toast.success(t("success.resetLinkSent"));
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 429) {
        toast.error(t("errors.rateLimited"));
      } else {
        // Always show success message to not reveal if email exists
        setIsSubmitted(true);
        toast.success(t("success.resetLinkSent"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t("success.resetLinkSent")}
        </p>
        <Link
          href={`/${locale}/login`}
          className="inline-block text-sm text-primary hover:underline font-medium"
        >
          {t("links.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("labels.email")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  autoComplete="email"
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
            t("buttons.sendResetLink")
          )}
        </Button>

        <p className="text-center">
          <Link
            href={`/${locale}/login`}
            className="text-sm text-primary hover:underline font-medium"
          >
            {t("links.backToLogin")}
          </Link>
        </p>
      </form>
    </Form>
  );
}
