'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/vendor-pass/button';
import { Avatar } from '@/components/vendor-pass/avatar';

export function AuthUserFooter() {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    fetch('/api/profile')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.profile) {
          setName(data.profile.full_name);
          setAvatar(data.profile.avatar_url);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="px-3 py-4 border-t border-sidebar-border mt-auto">
      <Link
        href="/settings"
        className="flex items-center gap-2.5 mb-2 -mx-1 px-1 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
      >
        <Avatar src={avatar} name={name} email={email} size={32} />
        <span className="min-w-0">
          {name && (
            <span className="block text-xs font-medium text-sidebar-foreground truncate">{name}</span>
          )}
          {email && (
            <span className="block text-[11px] text-sidebar-foreground/70 truncate" title={email}>
              {email}
            </span>
          )}
        </span>
      </Link>
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
