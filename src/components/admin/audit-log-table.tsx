'use client';

import { useState } from 'react';
import { ChevronRight, Clock3, Package, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AuditLog = {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'SOFT_DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  created_at_label: string;
  tenants: { name: string } | null;
};

type AuditActor = { name: string; email: string | null };
type InvoiceItem = {
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
};

type AuditLogTableProps = {
  logs: AuditLog[];
  actors: Record<string, AuditActor>;
  invoiceItemsByInvoiceId: Record<string, InvoiceItem[]>;
};

const hiddenFields = new Set([
  'id',
  'tenant_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'deleted_by',
]);

function getActionColor(action: AuditLog['action']) {
  switch (action) {
    case 'INSERT': return 'bg-emerald-100 text-emerald-800';
    case 'UPDATE': return 'bg-blue-100 text-blue-800';
    case 'SOFT_DELETE': return 'bg-rose-100 text-rose-800';
  }
}

function getEntityName(tableName: string) {
  switch (tableName) {
    case 'items': return 'Item';
    case 'parties': return 'Party';
    case 'invoices': return 'Sale';
    case 'tenant_members': return 'Team member';
    default: return tableName.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

function getRecordName(log: AuditLog) {
  const record = log.new_data ?? log.old_data;
  if (!record) return getEntityName(log.table_name);
  if (log.table_name === 'invoices') {
    const invoiceNumber = record.invoice_number;
    const partyName = record.party_name;
    return [
      invoiceNumber !== null && invoiceNumber !== undefined ? `Sale #${invoiceNumber}` : 'Sale',
      typeof partyName === 'string' ? `· ${partyName}` : null,
    ].filter(Boolean).join(' ');
  }

  const name = record.name ?? record.item_name;
  return typeof name === 'string' && name.length > 0
    ? name
    : getEntityName(log.table_name);
}

function formatFieldName(field: string) {
  return field.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function getChangedFields(log: AuditLog) {
  const before = log.old_data ?? {};
  const after = log.new_data ?? {};

  if (log.action === 'INSERT') {
    return Object.entries(after).filter(([field]) => !hiddenFields.has(field)).map(([field, value]) => ({
      field,
      before: undefined,
      after: value,
    }));
  }

  if (log.action === 'SOFT_DELETE') {
    return Object.entries(before).filter(([field]) => !hiddenFields.has(field)).map(([field, value]) => ({
      field,
      before: value,
      after: undefined,
    }));
  }

  return Object.entries(after)
    .filter(([field, value]) =>
      !hiddenFields.has(field) && JSON.stringify(before[field]) !== JSON.stringify(value)
    )
    .map(([field, value]) => ({
      field,
      before: before[field],
      after: value,
    }));
}

function AuditLogDetails({
  log,
  actor,
  invoiceItems,
}: {
  log: AuditLog;
  actor: AuditActor | undefined;
  invoiceItems: InvoiceItem[];
}) {
  const changedFields = getChangedFields(log);
  const actionText = log.action === 'SOFT_DELETE'
    ? 'soft deleted'
    : log.action.toLowerCase();

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Performed by</p>
            <p className="break-all font-medium">
              {actor?.name ?? (log.user_id ? 'Unknown user' : 'System')}
            </p>
            {actor?.email && actor.email !== actor.name && (
              <p className="break-all text-xs text-muted-foreground">{actor.email}</p>
            )}
            {log.user_id && (
              <p className="break-all font-mono text-[11px] text-muted-foreground">{log.user_id}</p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">When</p>
            <p className="font-medium">{log.created_at_label}</p>
          </div>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          {log.action === 'SOFT_DELETE' ? 'Deleted record details' : 'Record details'}
        </h3>
        {changedFields.length > 0 ? (
          <div className="max-h-72 overflow-auto rounded-lg border">
            <dl className="divide-y">
              {changedFields.map(({ field, before, after }) => (
                <div key={field} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1.3fr)] sm:gap-4">
                  <dt className="text-sm font-medium">{formatFieldName(field)}</dt>
                  <dd className="min-w-0 space-y-1 text-sm">
                    {log.action !== 'INSERT' && (
                      <p className="break-words text-muted-foreground">
                        <span className="mr-1 text-xs font-medium uppercase">Before</span>
                        <span className="whitespace-pre-wrap">{formatValue(before)}</span>
                      </p>
                    )}
                    {log.action !== 'SOFT_DELETE' && (
                      <p className="break-words">
                        <span className="mr-1 text-xs font-medium uppercase text-muted-foreground">After</span>
                        <span className="whitespace-pre-wrap">{formatValue(after)}</span>
                      </p>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="rounded-lg border p-3 text-sm text-muted-foreground">
            No field-level changes are available for this audit entry.
          </p>
        )}
      </section>

      {log.table_name === 'invoices' && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Package className="size-4" />
            Sale items
          </h3>
          {invoiceItems.length > 0 ? (
            <div className="space-y-2 rounded-lg border p-3">
              {invoiceItems.map((item, index) => (
                <div key={`${item.item_name}-${index}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{item.item_name}</span>
                  <span className="text-muted-foreground">
                    {item.quantity} {item.unit} × {item.rate} = {item.amount}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border p-3 text-sm text-muted-foreground">
              No sale line items are available for this record.
            </p>
          )}
        </section>
      )}

      <p className="break-all text-xs text-muted-foreground">
        Record ID: <span className="font-mono">{log.record_id}</span>
      </p>
      <p className="sr-only">
        {getEntityName(log.table_name)} {getRecordName(log)} was {actionText}.
      </p>
    </div>
  );
}

export function AuditLogTable({
  logs,
  actors,
  invoiceItemsByInvoiceId,
}: AuditLogTableProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Record</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const actor = log.user_id ? actors[log.user_id] : undefined;
              return (
                <TableRow
                  key={log.id}
                  className="cursor-pointer focus-within:bg-muted/50 hover:bg-muted/50"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="text-sm">{log.created_at_label}</TableCell>
                  <TableCell className="font-medium">
                    {log.tenants?.name || 'Unknown Tenant'}
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-48 truncate font-medium">
                      {actor?.name ?? (log.user_id ? 'Unknown user' : 'System')}
                    </span>
                    {actor?.email && actor.email !== actor.name && (
                      <span className="block max-w-48 truncate text-xs text-muted-foreground">
                        {actor.email}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getActionColor(log.action)}>
                      {log.action.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-56 truncate font-medium">{getRecordName(log)}</span>
                    <span className="text-xs text-muted-foreground">{getEntityName(log.table_name)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`View details for ${getRecordName(log)}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedLog(log);
                      }}
                    >
                      View
                      <ChevronRight className="ml-1 size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  No audit logs recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={selectedLog !== null} onOpenChange={(open) => {
        if (!open) setSelectedLog(null);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedLog && (
            <>
              <DialogHeader className="pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>{getRecordName(selectedLog)}</DialogTitle>
                  <Badge variant="outline" className={getActionColor(selectedLog.action)}>
                    {selectedLog.action.replace('_', ' ')}
                  </Badge>
                </div>
                <DialogDescription>
                  {getEntityName(selectedLog.table_name)} in {selectedLog.tenants?.name ?? 'Unknown Tenant'}
                </DialogDescription>
              </DialogHeader>
              <AuditLogDetails
                log={selectedLog}
                actor={selectedLog.user_id ? actors[selectedLog.user_id] : undefined}
                invoiceItems={invoiceItemsByInvoiceId[selectedLog.record_id] ?? []}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
