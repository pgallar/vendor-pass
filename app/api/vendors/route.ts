import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/api-auth';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json();
  const { data, error } = await auth.supabase
    .from('vendors')
    .insert({
      name: body.name,
      category: body.category ?? null,
      owner_name: body.owner_name ?? null,
      owner_email: body.owner_email ?? null,
      area: body.area ?? null,
      notes: body.notes ?? null,
      user_id: auth.user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ vendor: data }, { status: 201 });
}
