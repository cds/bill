'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { selectActiveTenant } from '@/app/actions/tenant-selection';
import { toast } from 'sonner';

type TenantOption = { id: string; name: string };

export function TenantSwitcher({
  tenants,
  selectedTenantId,
}: {
  tenants: TenantOption[];
  selectedTenantId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleChange = async (tenantId: string | null) => {
    if (!tenantId || tenantId === selectedTenantId || loading) return;

    setLoading(true);
    try {
      const result = await selectActiveTenant(tenantId);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select value={selectedTenantId} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className="w-36 sm:w-52" aria-label="Switch tenant">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {tenants.map((tenant) => (
          <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
