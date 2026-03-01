'use client';

import { MessageSquare } from 'lucide-react';

import { ContactForm } from '@/components/features/contact/contact-form';

export default function ContactPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fale Conosco</h1>
          <p className="text-sm text-muted-foreground">
            Tem uma duvida, sugestao ou problema? Entre em contato conosco.
          </p>
        </div>
      </div>

      {/* Form */}
      <ContactForm />
    </div>
  );
}
