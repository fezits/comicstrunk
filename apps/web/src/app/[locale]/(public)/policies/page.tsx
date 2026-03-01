'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  FileText,
  Shield,
  CreditCard,
  RotateCcw,
  Truck,
  XCircle,
  Cookie,
  Store,
} from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const POLICY_LINKS = [
  {
    href: '/terms',
    icon: FileText,
    title: 'Termos de Uso',
    description: 'Regras e condicoes para uso da plataforma',
  },
  {
    href: '/privacy',
    icon: Shield,
    title: 'Politica de Privacidade',
    description: 'Como coletamos, usamos e protegemos seus dados',
  },
  {
    href: '/seller-terms',
    icon: Store,
    title: 'Termos do Vendedor',
    description: 'Termos e condicoes especificos para vendedores',
  },
  {
    href: '/policies/payment',
    icon: CreditCard,
    title: 'Politica de Pagamento',
    description: 'Metodos de pagamento e processamento',
  },
  {
    href: '/policies/returns',
    icon: RotateCcw,
    title: 'Politica de Devolucao',
    description: 'Prazos e condicoes para devolucoes',
  },
  {
    href: '/policies/shipping',
    icon: Truck,
    title: 'Politica de Envio',
    description: 'Prazos de envio e responsabilidades',
  },
  {
    href: '/policies/cancellation',
    icon: XCircle,
    title: 'Politica de Cancelamento',
    description: 'Condicoes para cancelamento de pedidos e assinaturas',
  },
  {
    href: '/policies/cookies',
    icon: Cookie,
    title: 'Politica de Cookies',
    description: 'Como utilizamos cookies e tecnologias similares',
  },
];

export default function PoliciesPage() {
  const locale = useLocale();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Politicas e Termos
        </h1>
        <p className="mt-2 text-muted-foreground">
          Consulte nossos documentos legais, termos de uso e politicas da plataforma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {POLICY_LINKS.map((policy) => {
          const Icon = policy.icon;
          return (
            <Link key={policy.href} href={`/${locale}${policy.href}`}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/50">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{policy.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {policy.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
