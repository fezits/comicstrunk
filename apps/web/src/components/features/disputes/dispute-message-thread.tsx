'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { DisputeMessage } from '@/lib/api/disputes';

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

interface DisputeMessageThreadProps {
  messages: DisputeMessage[];
  buyerId: string;
  sellerId: string;
}

export function DisputeMessageThread({
  messages,
  buyerId,
  sellerId,
}: DisputeMessageThreadProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          Nenhuma mensagem nesta disputa ainda.
        </p>
      </div>
    );
  }

  function getSenderRole(senderId: string): {
    label: string;
    alignment: 'left' | 'right' | 'center';
    bgClass: string;
    labelClass: string;
  } {
    if (senderId === buyerId) {
      return {
        label: 'Comprador',
        alignment: 'left',
        bgClass: 'bg-muted',
        labelClass: 'text-blue-600 dark:text-blue-400',
      };
    }
    if (senderId === sellerId) {
      return {
        label: 'Vendedor',
        alignment: 'right',
        bgClass: 'bg-primary/10',
        labelClass: 'text-purple-600 dark:text-purple-400',
      };
    }
    // Admin
    return {
      label: 'Administrador',
      alignment: 'center',
      bgClass: 'bg-amber-500/10 border border-amber-500/20',
      labelClass: 'text-amber-600 dark:text-amber-400',
    };
  }

  return (
    <div className="space-y-4">
      {messages.map((msg) => {
        const role = getSenderRole(msg.sender.id);

        if (role.alignment === 'center') {
          // Admin message - centered
          return (
            <div key={msg.id} className="flex justify-center">
              <div className={`max-w-[85%] rounded-lg px-4 py-3 ${role.bgClass}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${role.labelClass}`}>
                    {role.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              </div>
            </div>
          );
        }

        const isRight = role.alignment === 'right';

        return (
          <div
            key={msg.id}
            className={`flex gap-2 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={msg.sender.avatarUrl ?? undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(msg.sender.name)}
              </AvatarFallback>
            </Avatar>

            <div
              className={`max-w-[75%] rounded-lg px-4 py-3 ${role.bgClass}`}
            >
              <div
                className={`flex items-center gap-2 mb-1 ${isRight ? 'flex-row-reverse' : ''}`}
              >
                <span className={`text-xs font-semibold ${role.labelClass}`}>
                  {role.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
