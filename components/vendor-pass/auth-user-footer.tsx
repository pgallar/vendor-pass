'use client';

import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/vendor-pass/button';

export function AuthUserFooter() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <div className="px-3 py-4 border-t border-sidebar-border mt-auto">
      {email && (
        <p className="text-xs text-sidebar-foreground/70 truncate mb-2 px-1" title={email}>
          {email}
        </p>
      )}
      <form action="/auth/signout" method="post">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground min-h-11"
          leftIcon={<LogOut size={16} aria-hidden="true" />}
        >
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
