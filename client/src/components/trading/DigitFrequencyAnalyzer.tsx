import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDigitFrequency } from '@/hooks/useDigitFrequency';
import { DigitCircle } from './DigitCircle';
import { SYMBOLS } from '@/types/trading';
import { cn } from '@/lib/utils';

export function DigitFrequencyAnalyzer() {
  const {
    isConnected,
    currentSymbol,
    currentPeriod,
    livePrice,
    currentDigit,
    frequencies,
    mostFrequent,
    leastFrequent,
    connect,
    changePeriod,
    changeSymbol,
  } = useDigitFrequency();

  useEffect(() => {
    connect();
  }, []);

  const handleSymbolChange = (value: string) => {
    changeSymbol(value);
  };

  const handlePeriodChange = (value: string) => {
    changePeriod(parseInt(value));
  };

  return (
    <Card className="bg-gradient-panel border-border/50 h-full animate-fade-in flex flex-col flex-1 min-h-0">
      <CardHeader className="p-2.5 md:p-3 pb-1.5 md:pb-2 space-y-2 md:space-y-3 flex-none">
        <div className="flex items-center justify-between flex-wrap gap-2 md:gap-4 p-1 md:p-0">
          <CardTitle className="text-xs md:text-lg flex items-center gap-2">
            <span>🔢</span> Digit Freq
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] md:text-sm font-medium",
              isConnected
                ? 'bg-success/10 text-success border border-success/30'
                : 'bg-muted/50 text-muted-foreground'
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground'
              )} />
              <span>{isConnected ? 'Live' : '...'}</span>
            </div>

            {/* Controls Integrated in Header Row for Mobile */}
            <div className="flex items-center gap-1">
              <Select value={currentSymbol} onValueChange={handleSymbolChange}>
                <SelectTrigger className="h-6 md:h-7 text-[10px] md:text-xs w-[64px] md:w-[88px] px-1 md:px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map(s => (
                    <SelectItem key={s.code} value={s.code} className="text-xs md:text-sm">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(currentPeriod)} onValueChange={handlePeriodChange}>
                <SelectTrigger className="h-6 md:h-7 text-[10px] md:text-xs w-[52px] md:w-[72px] px-1 md:px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50" className="text-xs md:text-sm">50</SelectItem>
                  <SelectItem value="120" className="text-xs md:text-sm">120</SelectItem>
                  <SelectItem value="500" className="text-xs md:text-sm">500</SelectItem>
                  <SelectItem value="1000" className="text-xs md:text-sm">1k</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 md:p-5 pt-0 space-y-3 md:space-y-6 flex-1 min-h-0 overflow-y-auto">
        {/* Live Price - Mini */}
        <div className="text-center bg-secondary/10 rounded-lg border border-secondary/30 mb-1 py-1">
          <p className="text-sm md:text-3xl font-bold font-mono text-secondary">{livePrice}</p>
        </div>

        {/* Digit Grid - Compact */}
        <div className="space-y-1 md:space-y-4 py-1 md:py-4">
          {/* First row: digits 0-4 */}
          <div className="grid grid-cols-5 gap-1 md:gap-4 justify-items-center">
            {frequencies.filter(f => f.digit <= 4).map((freq) => (
              <DigitCircle
                key={freq.digit}
                digit={freq.digit}
                percentage={freq.percentage}
                rank={freq.rank}
                isActive={currentDigit === freq.digit}
                compact={true} // Add compact prop
              />
            ))}
          </div>
          {/* Second row: digits 5-9 */}
          <div className="grid grid-cols-5 gap-1 md:gap-4 justify-items-center">
            {frequencies.filter(f => f.digit >= 5).map((freq) => (
              <DigitCircle
                key={freq.digit}
                digit={freq.digit}
                percentage={freq.percentage}
                rank={freq.rank}
                isActive={currentDigit === freq.digit}
                compact={true}
              />
            ))}
          </div>
        </div>

        {/* Cursor explanation */}
        <p className="text-center text-[8px] md:text-xs text-destructive opacity-80 -mt-1 mb-1">
          🔻 = Current
        </p>

        {/* Insights Grid - Compact Single Line */}
        <div className="flex items-center justify-between text-[10px] md:text-sm bg-muted/20 rounded-md p-1 border border-border/30">
          <div className="flex items-center gap-1 md:gap-2">
            <span className="text-muted-foreground uppercase">Most:</span>
            <span className="font-bold text-success">{mostFrequent?.digit ?? '-'}</span>
            <span className="text-muted-foreground">({mostFrequent?.percentage.toFixed(1) ?? 0}%)</span>
          </div>
          <div className="h-3 w-px bg-border/50" />
          <div className="flex items-center gap-1 md:gap-2">
            <span className="text-muted-foreground uppercase">Least:</span>
            <span className="font-bold text-destructive">{leastFrequent?.digit ?? '-'}</span>
            <span className="text-muted-foreground">({leastFrequent?.percentage.toFixed(1) ?? 0}%)</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap text-[10px] md:text-xs">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600" />
            <span className="text-muted-foreground">Most Frequent</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
            <span className="text-muted-foreground">Second Most</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600" />
            <span className="text-muted-foreground">Second Least</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gradient-to-br from-red-400 to-red-600" />
            <span className="text-muted-foreground">Least Frequent</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
