'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash } from 'lucide-react';
import { toast } from 'sonner';
import type { Party } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { PartyForm } from '@/components/parties/party-form';
import { DiscardRecordDialog } from '@/components/shared/discard-record-dialog';

export function PartyDetailActions({
  party,
  canDiscardRecords,
}: {
  party: Party;
  canDiscardRecords: boolean;
}) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  const discardParty = async (reason: string) => {
    const response = await fetch(`/api/parties/${party.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || 'Failed to discard party');
    }

    toast.success('Party discarded');
    router.refresh();
  };

  return (
    <>
      <div className="flex space-x-2">
        <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </Button>
        {canDiscardRecords && (
          <Button variant="destructive" size="sm" onClick={() => setIsDiscardOpen(true)}>
            <Trash className="w-4 h-4 mr-2" />
            Discard
          </Button>
        )}
      </div>
      <PartyForm
        party={party}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSaved={() => setIsEditOpen(false)}
      />
      {canDiscardRecords && (
        <DiscardRecordDialog
          open={isDiscardOpen}
          onOpenChange={setIsDiscardOpen}
          recordName="party"
          onConfirm={discardParty}
        />
      )}
    </>
  );
}
