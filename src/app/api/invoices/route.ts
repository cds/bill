import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const party_id = searchParams.get('party_id');

  let query = supabase.from('invoices').select('*').order('created_at', { ascending: false });

  if (party_id) {
    query = query.eq('party_id', party_id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const { 
      invoice_date, party_id, party_name, payment_type, payment_method,
      amount_paid, notes, items 
    } = body;

    // Validate
    if (!party_name) {
      return NextResponse.json({ error: 'Party name is required' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Server-side total calculation
    let subtotal = 0;
    let tax_amount = 0;
    let discount_amount = 0;

    const computedItems = items.map((item: any) => {
      const baseAmount = item.quantity * item.rate;
      const lineDiscount = baseAmount * (item.discount_percent || 0) / 100;
      const afterDiscount = baseAmount - lineDiscount;
      const lineTax = afterDiscount * (item.tax_percent || 0) / 100;
      const lineTotal = afterDiscount + lineTax;

      subtotal += baseAmount;
      discount_amount += lineDiscount;
      tax_amount += lineTax;

      return { ...item, tax_amount: lineTax, discount_amount: lineDiscount, amount: lineTotal };
    });

    const total_amount = subtotal - discount_amount + tax_amount;
    const paid = payment_type === 'cash' ? total_amount : (amount_paid || 0);
    const balance_due = total_amount - paid;

    // Insert Invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_date: invoice_date || new Date().toISOString().split('T')[0],
        party_id: party_id || null,
        party_name,
        payment_type: payment_type || 'cash',
        payment_method: payment_method || 'cash',
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        amount_paid: paid,
        balance_due,
        notes: notes || null,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Prepare items to insert
    const invoiceItemsToInsert = computedItems.map((item: any) => ({
      invoice_id: invoice.id,
      item_id: item.item_id || null,
      item_name: item.item_name,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      tax_percent: item.tax_percent || 0,
      tax_amount: item.tax_amount,
      discount_percent: item.discount_percent || 0,
      discount_amount: item.discount_amount,
      amount: item.amount,
    }));

    // Insert Items
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItemsToInsert);

    if (itemsError) {
      // Cleanup on failure (poor man's rollback)
      await supabase.from('invoices').delete().eq('id', invoice.id);
      throw itemsError;
    }

    // Process Stock Adjustments
    const itemsWithIds = computedItems.filter((i: any) => i.item_id);
    if (itemsWithIds.length > 0) {
      // Update stock
      for (const item of itemsWithIds) {
        const { data: currentItem } = await supabase
          .from('items')
          .select('current_stock')
          .eq('id', item.item_id)
          .single();
          
        if (currentItem) {
          await supabase
            .from('items')
            .update({ current_stock: Number(currentItem.current_stock) - item.quantity })
            .eq('id', item.item_id);
        }
      }

      // Record adjustments
      const adjustments = itemsWithIds.map((item: any) => ({
        item_id: item.item_id,
        type: 'sale',
        quantity: item.quantity,
        reference_id: invoice.id,
        notes: `Sale #${invoice.invoice_number}`
      }));

      await supabase.from('stock_adjustments').insert(adjustments);
    }

    // Update Party Balance
    if (payment_type === 'credit' && balance_due > 0 && party_id) {
      const { data: party } = await supabase
        .from('parties')
        .select('balance')
        .eq('id', party_id)
        .single();
        
      if (party) {
        await supabase
          .from('parties')
          .update({ balance: party.balance + balance_due })
          .eq('id', party_id);
      }
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: any) {
    console.error('Invoice creation error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
