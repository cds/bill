'use client';

import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

export function CopyUuidButton({ uuid }: { uuid: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(uuid);
    toast.success('UUID copied to clipboard!');
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy UUID">
      <Copy className="w-4 h-4 text-muted-foreground" />
    </Button>
  );
}
