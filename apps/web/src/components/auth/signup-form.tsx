"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@comicstrunk/contracts";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";

import { useAuth } from "@/lib/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function SignupForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { signup } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      acceptedTerms: false as unknown as true,
    },
  });

  const password = form.watch("password");

  // Password requirement checks
  const passwordChecks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  async function onSubmit(data: SignupInput) {
    setIsSubmitting(true);
    try {
      await signup(data);
      toast.success(t("success.accountCreated"));
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number; data?: { error?: { message?: string } } } };
      const status = apiError.response?.status;
      const message = apiError.response?.data?.error?.message;

      if (status === 429) {
        toast.error(t("errors.rateLimited"));
      } else if (status === 409 || message?.includes("already exists")) {
        toast.error(t("errors.emailAlreadyExists"));
      } else {
        toast.error(t("errors.emailAlreadyExists"));
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("labels.name")}</FormLabel>
              <FormControl>
                <Input
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />

              {/* Password requirements indicator */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-muted-foreground font-medium">
                    {t("passwordRequirements.title")}
                  </p>
                  <PasswordRequirement
                    met={passwordChecks.minLength}
                    label={t("passwordRequirements.minLength")}
                  />
                  <PasswordRequirement
                    met={passwordChecks.uppercase}
                    label={t("passwordRequirements.uppercase")}
                  />
                  <PasswordRequirement
                    met={passwordChecks.lowercase}
                    label={t("passwordRequirements.lowercase")}
                  />
                  <PasswordRequirement
                    met={passwordChecks.number}
                    label={t("passwordRequirements.number")}
                  />
                </div>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acceptedTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-normal cursor-pointer">
                  {t("labels.acceptTerms")}
                </FormLabel>
                <FormMessage />
              </div>
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
            t("buttons.signup")
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t("links.haveAccount")}{" "}
          <Link
            href={`/${locale}/login`}
            className="text-primary hover:underline font-medium"
          >
            {t("login.title")}
          </Link>
        </p>
      </form>
    </Form>
  );
}

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <X className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={met ? "text-green-500" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}
