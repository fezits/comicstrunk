'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { AxiosError } from 'axios';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { submitContactMessage, type ContactCategory } from '@/lib/api/contact';
import { ContactSuccess } from './contact-success';

interface FormErrors {
  name?: string;
  email?: string;
  category?: string;
  subject?: string;
  message?: string;
}

const CATEGORY_OPTIONS: { value: ContactCategory; label: string }[] = [
  { value: 'SUGGESTION', label: 'Sugestao' },
  { value: 'PROBLEM', label: 'Problema' },
  { value: 'PARTNERSHIP', label: 'Parceria' },
  { value: 'OTHER', label: 'Outro' },
];

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<ContactCategory | ''>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Nome e obrigatorio';
    }

    if (!email.trim()) {
      newErrors.email = 'E-mail e obrigatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'E-mail invalido';
    }

    if (!category) {
      newErrors.category = 'Selecione uma categoria';
    }

    if (!subject.trim()) {
      newErrors.subject = 'Assunto e obrigatorio';
    } else if (subject.length > 200) {
      newErrors.subject = 'Assunto deve ter no maximo 200 caracteres';
    }

    if (!message.trim()) {
      newErrors.message = 'Mensagem e obrigatoria';
    } else if (message.trim().length < 10) {
      newErrors.message = 'Mensagem deve ter no minimo 10 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        category: category as ContactCategory,
        subject: subject.trim(),
        message: message.trim(),
      });
      setIsSuccess(true);
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 429) {
        toast.error('Muitas mensagens enviadas. Tente novamente mais tarde.');
      } else {
        toast.error('Erro ao enviar mensagem. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setName('');
    setEmail('');
    setCategory('');
    setSubject('');
    setMessage('');
    setErrors({});
    setIsSuccess(false);
  }

  if (isSuccess) {
    return <ContactSuccess onReset={handleReset} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="contact-name">Nome *</Label>
        <Input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          placeholder="Seu nome"
          aria-invalid={!!errors.name}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="contact-email">E-mail *</Label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          placeholder="seu@email.com"
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="contact-category">Categoria *</Label>
        <Select
          value={category}
          onValueChange={(val) => {
            setCategory(val as ContactCategory);
            if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
          }}
        >
          <SelectTrigger id="contact-category" aria-invalid={!!errors.category}>
            <SelectValue placeholder="Selecione uma categoria" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="contact-subject">Assunto *</Label>
        <Input
          id="contact-subject"
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }));
          }}
          placeholder="Resumo da sua mensagem"
          maxLength={200}
          aria-invalid={!!errors.subject}
        />
        {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="contact-message">Mensagem *</Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
          }}
          placeholder="Descreva em detalhes sua duvida, sugestao ou problema..."
          rows={6}
          aria-invalid={!!errors.message}
        />
        {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Enviar Mensagem
          </>
        )}
      </Button>
    </form>
  );
}
