'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { deleteTenant } from '@/app/actions/admin-actions';
import { toast } from 'sonner';

export function DeleteTenantButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this tenant? All associated data will be lost.')) return;
    
    setLoading(true);
    const result = await deleteTenant(id);
    setLoading(false);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Tenant deleted');
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={loading} title="Delete Tenant">
      <Trash2 className="w-4 h-4 text-destructive" />
    </Button>
  );
}
