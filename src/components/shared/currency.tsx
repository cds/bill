'use client';

import { formatCurrency } from '@/lib/utils';

interface CurrencyProps {
  amount: number;
  className?: string;
  colored?: boolean; // green for positive, red for negative
}

export function Currency({ amount, className, colored = false }: CurrencyProps) {
  const colorClass = colored
    ? amount > 0
      ? 'text-green-600'
      : amount < 0
        ? 'text-red-600'
        : 'text-muted-foreground'
    : '';

  return (
    <span className={`${colorClass} ${className || ''}`.trim()}>
      {formatCurrency(Math.abs(amount))}
    </span>
  );
}
