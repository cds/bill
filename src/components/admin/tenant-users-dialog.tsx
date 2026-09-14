'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { addTenantMember } from '@/app/actions/admin-actions';

export function TenantUsersDialog({ tenantId, trigger }: { tenantId: string, trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('worker');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    
    setLoading(true);
    const result = await addTenantMember(tenantId, userId, role);
    setLoading(false);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('User added to tenant');
      setOpen(false);
      setUserId('');
      setRole('worker');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign User to Tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="userId">User UUID</Label>
            <Input id="userId" required value={userId} onChange={e => setUserId(e.target.value)} placeholder="e.g. 123e4567-e89b-12d3-a456-..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(val: string | null) => setRole(val || 'worker')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                <SelectItem value="distributor">Distributor</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Assigning...' : 'Assign User'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
