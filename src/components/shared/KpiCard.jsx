import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KpiCard({ title, value, subtitle, trend, trendDirection, icon: Icon, color = 'blue', size = 'md' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;
  const trendColor = trendDirection === 'up' ? 'text-green-600' : trendDirection === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        {Icon && (
          <div className={cn("p-2 rounded-lg", colorMap[color])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className={cn("font-bold text-foreground", size === 'lg' ? 'text-3xl' : 'text-2xl')}>
        {value}
      </div>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
              <TrendIcon className="w-3 h-3" />
              {trend}
            </div>
          )}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}