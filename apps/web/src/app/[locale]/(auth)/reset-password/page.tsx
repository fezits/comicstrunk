import { Suspense } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

function ResetPasswordContent() {
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth");

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl gradient-text">
          {t("resetPassword.title")}
        </CardTitle>
        <CardDescription>{t("resetPassword.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="text-center text-muted-foreground">...</div>}>
          <ResetPasswordContent />
        </Suspense>
      </CardContent>
    </Card>
  );
}
