import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }
  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .eq('tenant_id', tenantId);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  return NextResponse.json({ ...invoice, items });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }
  const supabase = await createClient();

  try {
    // 1. Fetch invoice and its items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError) throw invoiceError;

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .eq('tenant_id', tenantId);

    if (itemsError) throw itemsError;

    // 2. Revert stock
    for (const item of items || []) {
      if (item.item_id) {
        const { data: currentItem } = await supabase
          .from('items')
          .select('current_stock')
          .eq('id', item.item_id)
          .eq('tenant_id', tenantId)
          .single();
          
        if (currentItem) {
          await supabase
            .from('items')
            .update({ current_stock: currentItem.current_stock + item.quantity })
            .eq('id', item.item_id)
            .eq('tenant_id', tenantId);
        }
      }
    }

    // 3. Delete stock adjustments
    await supabase
      .from('stock_adjustments')
      .delete()
      .eq('reference_id', id)
      .eq('tenant_id', tenantId)
      .eq('type', 'sale');

    // 4. Revert party balance
    if (invoice.payment_type === 'credit' && invoice.balance_due > 0 && invoice.party_id) {
      const { data: party } = await supabase
        .from('parties')
        .select('balance')
        .eq('id', invoice.party_id)
        .eq('tenant_id', tenantId)
        .single();
        
      if (party) {
        await supabase
          .from('parties')
          .update({ balance: party.balance - invoice.balance_due })
          .eq('id', invoice.party_id)
          .eq('tenant_id', tenantId);
      }
    }

    // 5. Delete invoice (items cascade)
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Invoice deletion error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete invoice') },
      { status: 500 }
    );
  }
}
