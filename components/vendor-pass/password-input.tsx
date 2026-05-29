'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './form-field';

export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'rightAddon'>>(
  (props, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <Input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        rightAddon={
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer pointer-events-auto"
            tabIndex={0}
          >
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        }
      />
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
