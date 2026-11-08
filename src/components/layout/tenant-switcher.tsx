'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { selectActiveTenant } from '@/app/actions/tenant-selection';
import { PageLoading } from '@/components/shared/page-loading';
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
  const [isPending, startTransition] = useTransition();

  const handleChange = async (tenantId: string | null) => {
    if (!tenantId || tenantId === selectedTenantId || isPending) return;

    startTransition(async () => {
      try {
        const result = await selectActiveTenant(tenantId);
        if (result.error) {
          toast.error(result.error);
          return;
        }

        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to switch tenant');
      }
    });
  };

  return (
    <>
      <Select value={selectedTenantId} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-52" aria-label="Switch tenant">
          <SelectValue placeholder="Select tenant" />
        </SelectTrigger>
        <SelectContent>
          {tenants.map((tenant) => (
            <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && (
        <PageLoading
          overlay
          message="Switching tenant and loading its dashboard data."
        />
      )}
    </>
  );
}
