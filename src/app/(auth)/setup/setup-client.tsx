'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LogOut, Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export function SetupClient({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      router.push('/login');
      router.refresh();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(userId);
    toast.success('UUID copied to clipboard!');
  };

  return (
    <Card className="max-w-md w-full shadow-lg">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl font-bold">Welcome to Eatera Foods!</CardTitle>
        <CardDescription>
          It looks like you aren't assigned to a business tenant yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
        <p>
          To get access, please send your unique User ID to your Administrator so they can invite you to their business.
        </p>
        
        {userId && (
          <div className="bg-muted p-4 rounded-md space-y-2">
            <p className="font-medium text-foreground">Your User ID (UUID):</p>
            <code className="bg-background px-2 py-1 rounded text-xs select-all block break-all">
              {userId}
            </code>
            <Button variant="secondary" size="sm" onClick={copyToClipboard} className="w-full mt-2">
              <Copy className="w-4 h-4 mr-2" />
              Copy UUID
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground hover:text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </CardFooter>
    </Card>
  );
}
