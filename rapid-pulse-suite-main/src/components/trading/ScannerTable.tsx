import { cn } from '@/lib/utils';
import { ScannerSignal } from '@/types/trading';

interface ScannerTableProps {
  signals: ScannerSignal[];
  isLoading?: boolean;
}

export function ScannerTable({ signals, isLoading }: ScannerTableProps) {
  const getPercentageClass = (percentage: number) => {
    if (percentage >= 70) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-secondary';
  };

  const getDeviationClass = (deviation: number) => {
    if (deviation > 0) return 'bg-success/15 text-success border-success/30';
    if (deviation < 0) return 'bg-destructive/15 text-destructive border-destructive/30';
    return 'bg-muted/30 text-muted-foreground border-muted';
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'EVEN': return 'text-success';
      case 'ODD': return 'text-secondary';
      case 'OVER': return 'text-warning';
      case 'UNDER': return 'text-trading-orange';
      default: return 'text-foreground';
    }
  };

  if (signals.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="text-4xl mb-4 opacity-30">📊</div>
        <p className="text-sm">No signals above threshold</p>
        <p className="text-xs mt-1">Waiting for volatility opportunities...</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[500px]">
      <table className="w-full min-w-[600px]">
        <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
          <tr>
            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-secondary border-b-2 border-border">
              Symbol
            </th>
            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-secondary border-b-2 border-border">
              Confidence
            </th>
            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-secondary border-b-2 border-border">
              Signal
            </th>
            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-secondary border-b-2 border-border">
              Deviation
            </th>
            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-secondary border-b-2 border-border">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr 
              key={signal.symbol}
              className="border-b border-border/30 hover:bg-muted/20 transition-colors"
            >
              {/* Symbol */}
              <td className="px-5 py-4">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-sm text-foreground">{signal.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{signal.symbol}</span>
                    {signal.isOneSecond && (
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-trading-purple/15 text-trading-purple border border-trading-purple/30">
                        1s
                      </span>
                    )}
                  </div>
                </div>
              </td>
              
              {/* Confidence */}
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-20 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-success to-warning transition-all duration-500"
                      style={{ width: `${signal.percentage}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-base font-bold font-mono min-w-[50px]",
                    getPercentageClass(signal.percentage)
                  )}>
                    {signal.percentage.toFixed(1)}%
                  </span>
                </div>
              </td>
              
              {/* Signal */}
              <td className="px-5 py-4">
                <span className={cn("font-semibold text-sm", getSignalColor(signal.signal))}>
                  {signal.signal}
                </span>
              </td>
              
              {/* Deviation */}
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-mono font-bold px-2 py-1 rounded text-xs border",
                    getDeviationClass(signal.deviation)
                  )}>
                    {signal.deviation > 0 ? '+' : ''}{signal.deviation.toFixed(1)}%
                  </span>
                  {signal.deviation !== 0 && (
                    <span className={cn(
                      "text-base font-bold",
                      signal.deviation > 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {signal.deviation > 0 ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </td>
              
              {/* Updated */}
              <td className="px-5 py-4 text-sm text-muted-foreground">
                {signal.lastUpdate?.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                }) || '--:--:--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
