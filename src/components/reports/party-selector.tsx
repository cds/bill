'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type PartySelectorProps = {
  parties: { id: string; name: string }[];
};

export function PartySelector({ parties }: PartySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedPartyId = searchParams.get('party_id') || '';

  const handleValueChange = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set('party_id', value);
    } else {
      params.delete('party_id');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Select value={selectedPartyId} onValueChange={handleValueChange}>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a party" />
      </SelectTrigger>
      <SelectContent>
        {parties.map((party) => (
          <SelectItem key={party.id} value={party.id}>
            {party.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
