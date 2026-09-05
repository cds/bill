import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InsertExpense } from '@/lib/supabase/types';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error fetching expenses:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Unexpected error fetching expenses:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { date, category, amount, payment_mode, notes } = body;
    
    if (!date || !category || amount === undefined || amount === null || !payment_mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const expenseData: InsertExpense = {
      date,
      category,
      amount: Number(amount),
      payment_mode,
      payment_status: 'paid', // Defaulting to paid
      notes: notes || null,
    };
    
    const { data, error } = await supabase
      .from('expenses')
      .insert([expenseData])
      .select()
      .single();
      
    if (error) {
      console.error('Error creating expense:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating expense:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
