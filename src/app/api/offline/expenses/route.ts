import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type PaymentMode = 'cash' | 'bank' | 'upi';

function isPaymentMode(value: unknown): value is PaymentMode {
  return value === 'cash' || value === 'bank' || value === 'upi';
}

type OfflineExpenseInput = {
  id: string;
  tenant_id: string;
  date: string;
  category: string;
  amount: number;
  payment_mode: 'cash' | 'bank' | 'upi';
  notes: string | null;
};

function parseExpense(body: unknown, tenantId: string): OfflineExpenseInput | null {
  if (!body || typeof body !== 'object') return null;
  const candidate = body as Record<string, unknown>;
  const date = candidate.date;
  const category = candidate.category;
  const amount = candidate.amount;
  const paymentMode = candidate.payment_mode;
  const notes = candidate.notes;

  const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00.000Z`)
    : null;

  if (
    typeof candidate.id !== 'string' ||
    !UUID_PATTERN.test(candidate.id) ||
    candidate.tenant_id !== tenantId ||
    !parsedDate ||
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date ||
    typeof category !== 'string' ||
    !category.trim() ||
    category.trim().length > 100 ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !isPaymentMode(paymentMode) ||
    (notes !== null && typeof notes !== 'string') ||
    (typeof notes === 'string' && notes.length > 2000)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    tenant_id: tenantId,
    date,
    category: category.trim(),
    amount,
    payment_mode: paymentMode,
    notes: typeof notes === 'string' ? notes.trim() || null : null,
  };
}

function matchesExpense(
  existing: Record<string, unknown>,
  submitted: OfflineExpenseInput,
) {
  return existing.tenant_id === submitted.tenant_id &&
    existing.date === submitted.date &&
    existing.category === submitted.category &&
    Number(existing.amount) === submitted.amount &&
    existing.payment_mode === submitted.payment_mode &&
    (existing.notes ?? null) === submitted.notes &&
    existing.payment_status === 'paid';
}

export async function POST(request: Request) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const submittedTenantId = body && typeof body === 'object'
    ? (body as Record<string, unknown>).tenant_id
    : null;
  const submittedExpense = typeof submittedTenantId === 'string'
    ? parseExpense(body, submittedTenantId)
    : null;
  if (!submittedExpense) {
    return NextResponse.json({ error: 'Invalid expense details or tenant context' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Authentication is required to sync expenses' }, { status: 401 });
  }

  let effectiveTenantId = tenantId;
  const { data: roleData, error: roleError } = await supabase
    .from('users')
    .select('system_role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (roleError) {
    console.error('Failed to verify system role for offline expense:', roleError);
    return NextResponse.json({ error: 'Unable to verify user role' }, { status: 500 });
  }

  if (roleData?.system_role === 'super_admin') {
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as Record<string, unknown>).tenant_id !== 'string'
    ) {
      return NextResponse.json({ error: 'A selected tenant is required to sync expenses' }, { status: 400 });
    }
    effectiveTenantId = (body as Record<string, string>).tenant_id;
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', effectiveTenantId)
      .maybeSingle();

    if (tenantError) {
      console.error('Failed to validate selected tenant for offline expense:', tenantError);
      return NextResponse.json({ error: 'Unable to verify selected tenant' }, { status: 500 });
    }
    if (!tenant) {
      return NextResponse.json({ error: 'Selected tenant does not exist' }, { status: 403 });
    }
  } else {
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context is missing' }, { status: 403 });
    }
    if (submittedTenantId !== tenantId) {
      return NextResponse.json({ error: 'Invalid expense details or tenant context' }, { status: 400 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (membershipError) {
      console.error('Failed to verify tenant membership for offline expense:', membershipError);
      return NextResponse.json({ error: 'Unable to verify tenant membership' }, { status: 500 });
    }
    if (!membership) {
      return NextResponse.json({ error: 'Current user is not a member of this tenant' }, { status: 403 });
    }
  }

  const expense = submittedExpense;

  const expenseData = {
    ...expense,
    payment_status: 'paid',
  };
  const { data, error } = await supabase
    .from('expenses')
    .insert(expenseData)
    .select()
    .single();

  if (!error && data) {
    return NextResponse.json({ expense: data, duplicate: false }, { status: 201 });
  }

  if (error?.code === '23505') {
    const { data: existing, error: lookupError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expense.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (lookupError) {
      console.error('Failed to verify duplicate offline expense:', lookupError);
      return NextResponse.json({ error: 'Unable to verify expense retry' }, { status: 500 });
    }
    if (existing && matchesExpense(existing, expense)) {
      return NextResponse.json({ expense: existing, duplicate: true }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Expense ID already exists with different details or tenant' },
      { status: 409 },
    );
  }

  console.error('Failed to sync offline expense:', error);
  const status = error?.code === '42501' ? 403 : 500;
  return NextResponse.json({ error: error?.message ?? 'Failed to sync expense' }, { status });
}
