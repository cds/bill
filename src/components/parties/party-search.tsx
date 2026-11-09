'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@powersync/react';

export function PartySearch({
  value,
  onSelect,
  tenantId,
}: {
  value: { id: string; name: string } | null;
  onSelect: (party: { id: string; name: string }) => void;
  tenantId?: string;
}) {
  if (tenantId) {
    return <LocalPartySearch value={value} onSelect={onSelect} tenantId={tenantId} />;
  }
  return <OnlinePartySearch value={value} onSelect={onSelect} />;
}

type PartySearchProps = {
  value: { id: string; name: string } | null;
  onSelect: (party: { id: string; name: string }) => void;
};

type PartyOption = {
  id: string;
  name: string;
  phone: string | null;
};

function LocalPartySearch({
  value,
  onSelect,
  tenantId,
}: PartySearchProps & { tenantId: string }) {
  const result = useQuery<{ id: string; name: string; phone: string | null }>(
    `SELECT id, name, phone
     FROM parties
     WHERE tenant_id = ? AND deleted_at IS NULL AND type = 'customer'
     ORDER BY name`,
    [tenantId],
    {
      streams: [
        {
          name: 'current_tenant_parties',
          parameters: { tenant_id: tenantId },
          waitForStream: true,
        },
      ],
    },
  );
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {value ? value.name : 'Select cached customer...'}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search cached customers..." />
          <CommandList>
            <CommandEmpty>
              {result.isLoading ? 'Loading cached customers...' : 'No cached customer found.'}
            </CommandEmpty>
            <CommandGroup>
              {result.data.map((party) => (
                <CommandItem
                  key={party.id}
                  value={party.name}
                  onSelect={() => {
                    onSelect({ id: party.id, name: party.name });
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value?.id === party.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{party.name}</span>
                    {party.phone && (
                      <span className="text-xs text-muted-foreground">{party.phone}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {result.error ? (
            <p role="alert" className="border-t p-2 text-sm text-destructive">
              Could not load local customers: {result.error.message}
            </p>
          ) : null}
          <p className="border-t p-2 text-xs text-muted-foreground">
            Only previously synced customers are available offline.
          </p>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OnlinePartySearch({
  value,
  onSelect,
}: PartySearchProps) {
  const [open, setOpen] = React.useState(false);
  const [parties, setParties] = React.useState<PartyOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  
  // Quick add form state
  const [newName, setNewName] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [quickAddError, setQuickAddError] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch('/api/parties?type=customer')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return await response.json() as PartyOption[];
      })
      .then((data) => {
        if (!cancelled) setParties(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load parties.');
          console.error('Failed to fetch parties:', error);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setQuickAddError(null);
    try {
      const res = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, phone: newPhone, type: 'customer' }),
      });
      if (res.ok) {
        const newParty = await res.json();
        setParties((prev) => [...prev, newParty]);
        onSelect({ id: newParty.id, name: newParty.name });
        setQuickAddOpen(false);
        setNewName('');
        setNewPhone('');
        setOpen(false);
      } else {
        const response = await res.json().catch(() => null);
        setQuickAddError(response?.error || 'Failed to add party');
      }
    } catch (error) {
      console.error(error);
      setQuickAddError(error instanceof Error ? error.message : 'Failed to add party');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger 
          role="combobox"
          aria-expanded={open}
          className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {value ? value.name : 'Select party...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search party..." />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Loading parties...' : loadError ? 'Unable to load parties.' : 'No party found.'}
              </CommandEmpty>
              <CommandGroup>
                {parties.map((party) => (
                  <CommandItem
                    key={party.id}
                    value={party.name}
                    onSelect={() => {
                      onSelect({ id: party.id, name: party.name });
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value?.id === party.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{party.name}</span>
                      {party.phone && (
                        <span className="text-xs text-muted-foreground">
                          {party.phone}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                className="w-full justify-start text-sm"
                onClick={() => {
                  setOpen(false);
                  setQuickAddOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Quick Add Party
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Add Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuickAdd} className="space-y-4">
            {quickAddError && <p role="alert" className="text-sm text-destructive">{quickAddError}</p>}
            <div className="space-y-2">
              <Label htmlFor="quick-name">Name *</Label>
              <Input
                id="quick-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-phone">Phone</Label>
              <Input
                id="quick-phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickAddOpen(false)}
                disabled={adding}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
