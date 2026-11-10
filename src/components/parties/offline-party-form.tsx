'use client';

import { useState } from 'react';
import { usePowerSyncOrNull } from '@powersync/react';
import { savePartyLocally } from '@/lib/powersync/party-writes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, UserPlus, CloudUpload } from 'lucide-react';

export function OfflinePartyForm({
  tenantId,
  onSaved,
  onCancel,
}: {
  tenantId: string;
  onSaved?: (partyId: string) => void;
  onCancel?: () => void;
}) {
  const database = usePowerSyncOrNull();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [billingName, setBillingName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<'customer' | 'supplier'>('customer');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Name is required');
      return;
    }
    if (!database) {
      setErrorMessage('Offline database is not ready. Reopen when database loads.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const partyId = await savePartyLocally(database, tenantId, {
        name,
        billing_name: billingName || null,
        phone: phone || null,
        address: address || null,
        type,
      });

      if (onSaved) {
        onSaved(partyId);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save party locally');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center text-sm font-medium hover:underline text-muted-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Parties
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <CardTitle>Add New Party (Offline)</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Saves directly to this device and automatically syncs to cloud upon reconnection.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="party-name">Name *</Label>
              <Input
                id="party-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar or Shanti Traders"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="billing-name">Billing / Business Name (Optional)</Label>
              <Input
                id="billing-name"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
                placeholder="Trade name if different from personal name"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="party-phone">Phone Number</Label>
                <Input
                  id="party-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="party-type">Party Type</Label>
                <Select value={type} onValueChange={(val) => setType(val as 'customer' | 'supplier')}>
                  <SelectTrigger id="party-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="party-address">Billing Address</Label>
              <Textarea
                id="party-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop number, street, city..."
                rows={3}
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                <CloudUpload className="h-4 w-4" />
                {loading ? 'Saving...' : 'Save Party Locally'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
