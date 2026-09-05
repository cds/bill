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

export function PartySearch({
  value,
  onSelect,
}: {
  value: { id: string; name: string } | null;
  onSelect: (party: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [parties, setParties] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  
  // Quick add form state
  const [newName, setNewName] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  const fetchParties = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/parties?type=customer');
      if (res.ok) {
        const data = await res.json();
        setParties(data);
      }
    } catch (error) {
      console.error('Failed to fetch parties:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
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
      }
    } catch (error) {
      console.error(error);
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
              <CommandEmpty>No party found.</CommandEmpty>
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
