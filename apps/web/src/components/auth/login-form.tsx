"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@comicstrunk/contracts";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth/use-auth";
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

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginInput) {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      toast.success(t("success.loginSuccess"));
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number; data?: { error?: { message?: string } } } };
      const status = apiError.response?.status;
      const apiMsg = apiError.response?.data?.error?.message;

      if (status === 429) {
        toast.error(t("errors.rateLimited"));
      } else if (status === 403 && apiMsg) {
        // Account suspended or other forbidden — show the real backend message
        toast.error(apiMsg);
      } else if (status === 401) {
        toast.error(t("errors.invalidCredentials"));
      } else {
        toast.error(t("errors.invalidCredentials"));
      }
    } finally {
      setIsSubmitting(false);
    }
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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("labels.password")}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="********"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Link
            href={`/${locale}/forgot-password`}
            className="text-sm text-primary hover:underline"
          >
            {t("links.forgotPassword")}
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full gradient-primary text-white"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("buttons.login")
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t("links.noAccount")}{" "}
          <Link
            href={`/${locale}/signup`}
            className="text-primary hover:underline font-medium"
          >
            {t("signup.title")}
          </Link>
        </p>
      </form>
    </Form>
  );
}
