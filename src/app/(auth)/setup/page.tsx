export default function SetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-2xl font-bold">Welcome to Eatera Foods!</h1>
        <p className="text-muted-foreground">
          It looks like you aren't assigned to a business tenant yet.
          Please contact your administrator to get access or set up a new business profile.
        </p>
      </div>
    </div>
  );
}

