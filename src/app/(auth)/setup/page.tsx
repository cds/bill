import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SetupClient } from './setup-client';

export default async function SetupPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <SetupClient userId={user?.id || ''} />
    </div>
  );
}
