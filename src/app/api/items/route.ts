import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')
  const supabase = await createClient()

  let query = supabase.from('items').select('*').order('name')
  
  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  // Set current_stock to opening_stock
  const itemData = {
    ...body,
    current_stock: body.opening_stock || 0
  }

  const { data: item, error: itemError } = await supabase
    .from('items')
    .insert(itemData)
    .select()
    .single()

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 })
  }

  if (item.opening_stock > 0) {
    const { error: adjError } = await supabase
      .from('stock_adjustments')
      .insert({
        item_id: item.id,
        quantity: item.opening_stock,
        type: 'opening',
        notes: 'Opening stock'
      })

    if (adjError) {
      console.error('Failed to create stock adjustment', adjError)
    }
  }

  return NextResponse.json(item)
}
