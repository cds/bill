'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createTenant, updateTenant } from '@/app/actions/admin-actions';
import { toast } from 'sonner';

type Tenant = { id: string; name: string; status: string; };

export function TenantDialog({ tenant, trigger }: { tenant?: Tenant, trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(tenant?.name || '');
  const [status, setStatus] = useState(tenant?.status || 'active');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const result = tenant 
      ? await updateTenant(tenant.id, name, status)
      : await createTenant(name, status);
      
    setLoading(false);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(tenant ? 'Tenant updated' : 'Tenant created');
      setOpen(false);
      // Reset form if creating new
      if (!tenant) {
        setName('');
        setStatus('active');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tenant ? 'Edit Tenant' : 'Create New Tenant'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tenant Name</Label>
            <Input id="name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Eatera Foods" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(val: string | null) => setStatus(val || 'active')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving...' : 'Save Tenant'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
