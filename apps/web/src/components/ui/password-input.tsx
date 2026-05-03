'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type PasswordInputProps = Omit<
  React.ComponentProps<'input'>,
  'type'
> & {
  /** Override aria-label of the toggle button. Defaults: pt-BR. */
  toggleLabelShow?: string;
  toggleLabelHide?: string;
};

/**
 * Password input with a toggle eye button to show/hide the value.
 * Forwards ref/onChange/value/etc. to the underlying <Input>.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      className,
      toggleLabelShow = 'Mostrar senha',
      toggleLabelHide = 'Esconder senha',
      ...props
    },
    ref,
  ) {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? toggleLabelHide : toggleLabelShow}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
