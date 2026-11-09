'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function DiscardRecordDialog({
  open,
  onOpenChange,
  recordName,
  actionLabel = 'Discard',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordName: string;
  actionLabel?: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pastTense = actionLabel === 'Void' ? 'voided' : 'discarded';

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting) setReason('');
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;

    setIsSubmitting(true);
    try {
      await onConfirm(trimmedReason);
      setReason('');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${actionLabel.toLowerCase()} record`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            {actionLabel} {recordName}?
          </DialogTitle>
          <DialogDescription>
            This record will remain in history and be marked as {pastTense}. Its original details will be preserved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="discard-reason">Reason (required)</Label>
          <Textarea
            id="discard-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={`Why are you ${actionLabel.toLowerCase()}ing this record?`}
            rows={3}
            maxLength={500}
            required
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? `${actionLabel}ing...` : `${actionLabel} record`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
