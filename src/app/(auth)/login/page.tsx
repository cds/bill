'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setIsForgotPassword(false);
        setIsSignUp(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRecovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success('Password updated. You can now sign in.');
        setIsRecovery(false);
        setPassword('');
        router.push('/');
        router.refresh();
      } else if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://eatera.vercel.app').replace(/\/$/, '')}/login`,
        });
        if (error) throw error;
        toast.success('If an account exists for this email, a password reset link has been sent.');
        setIsForgotPassword(false);
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Account created! You can now log in.');
        setIsSignUp(false); // Switch to login view
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Logged in successfully');
        router.push('/');
        router.refresh();
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Eatera Foods</CardTitle>
            <CardDescription className="mt-1">
              {isRecovery
                ? 'Choose a new password'
                : isForgotPassword
                  ? 'Reset your password'
                  : isSignUp
                    ? 'Create a new account'
                    : 'Sign in to your account'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">{isRecovery ? 'New password' : 'Password'}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isRecovery ? 8 : undefined}
                  autoComplete={isRecovery ? 'new-password' : 'current-password'}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Processing...'
                : isRecovery
                  ? 'Update Password'
                  : isForgotPassword
                    ? 'Send Reset Link'
                    : isSignUp
                      ? 'Sign Up'
                      : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-1">
          {!isRecovery && !isForgotPassword && !isSignUp && (
            <Button
              type="button"
              variant="ghost"
              className="text-sm text-muted-foreground hover:text-primary"
              onClick={() => setIsForgotPassword(true)}
            >
              Forgot password?
            </Button>
          )}
          {!isRecovery && (
            <Button
              type="button"
              variant="ghost"
              className="text-sm text-muted-foreground hover:text-primary"
              onClick={() => {
                setIsForgotPassword(false);
                setIsSignUp(!isSignUp);
              }}
            >
              {isForgotPassword || isSignUp ? 'Back to sign in' : "Don't have an account? Sign up"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

