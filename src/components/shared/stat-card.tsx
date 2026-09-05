import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: 'up' | 'down';
  trendValue?: string;
  className?: string;
  iconClassName?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  className,
  iconClassName,
}: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {title}
            </p>
            <p className="text-lg font-bold mt-1 truncate">{value}</p>
            {trend && trendValue && (
              <div className="flex items-center gap-1 mt-1">
                {trend === 'up' ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend === 'up' ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trendValue}
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              'rounded-full p-2.5 flex-shrink-0 ml-3',
              iconClassName || 'bg-primary/10 text-primary'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
