import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const { type, quantity, date, unit_cost, notes } = body

    if (!type || !quantity || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get current stock
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('current_stock')
      .eq('id', id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const currentStock = item.current_stock
    const parsedQuantity = Number(quantity)
    const newStock = type === 'add' ? currentStock + parsedQuantity : currentStock - parsedQuantity

    // Insert adjustment
    const { error: adjustError } = await supabase
      .from('stock_adjustments')
      .insert({
        item_id: id,
        type,
        quantity: parsedQuantity,
        date,
        unit_cost: Number(unit_cost || 0),
        notes,
      })

    if (adjustError) {
      console.error('Error inserting stock adjustment:', adjustError)
      return NextResponse.json({ error: 'Failed to record adjustment' }, { status: 500 })
    }

    // Update item stock
    const { error: updateError } = await supabase
      .from('items')
      .update({ current_stock: newStock })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating item stock:', updateError)
      return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 })
    }

    return NextResponse.json({ success: true, newStock })
  } catch (error) {
    console.error('Error processing stock adjustment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
