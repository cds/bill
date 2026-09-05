import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  return NextResponse.json({ ...invoice, items });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    // 1. Fetch invoice and its items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (invoiceError) throw invoiceError;

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id);

    if (itemsError) throw itemsError;

    // 2. Revert stock
    for (const item of items || []) {
      if (item.item_id) {
        const { data: currentItem } = await supabase
          .from('items')
          .select('current_stock')
          .eq('id', item.item_id)
          .single();
          
        if (currentItem) {
          await supabase
            .from('items')
            .update({ current_stock: currentItem.current_stock + item.quantity })
            .eq('id', item.item_id);
        }
      }
    }

    // 3. Delete stock adjustments
    await supabase
      .from('stock_adjustments')
      .delete()
      .eq('reference_id', id)
      .eq('type', 'sale');

    // 4. Revert party balance
    if (invoice.payment_type === 'credit' && invoice.balance_due > 0 && invoice.party_id) {
      const { data: party } = await supabase
        .from('parties')
        .select('balance')
        .eq('id', invoice.party_id)
        .single();
        
      if (party) {
        await supabase
          .from('parties')
          .update({ balance: party.balance - invoice.balance_due })
          .eq('id', invoice.party_id);
      }
    }

    // 5. Delete invoice (items cascade)
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Invoice deletion error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete invoice' }, { status: 500 });
  }
}
