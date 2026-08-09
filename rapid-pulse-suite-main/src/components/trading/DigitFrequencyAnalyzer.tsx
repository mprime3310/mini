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
    <Card className="bg-gradient-panel border-border/50 h-full animate-fade-in">
      <CardHeader className="p-3 md:p-5 pb-3 md:pb-4 space-y-3 md:space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 md:gap-4">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <span>🔢</span> Digit Frequency Analyzer
          </CardTitle>
          <div className={cn(
            "flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-md text-xs md:text-sm font-medium",
            isConnected 
              ? 'bg-success/10 text-success border border-success/30' 
              : 'bg-muted/50 text-muted-foreground'
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground'
            )} />
            <span>{isConnected ? 'Live' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Controls - Responsive grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-4">
          <div className="space-y-2">
            <label className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
              Symbol
            </label>
            <Select value={currentSymbol} onValueChange={handleSymbolChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYMBOLS.map(s => (
                  <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
              Analysis Period
            </label>
            <Select value={String(currentPeriod)} onValueChange={handlePeriodChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 Ticks</SelectItem>
                <SelectItem value="120">120 Ticks</SelectItem>
                <SelectItem value="500">500 Ticks</SelectItem>
                <SelectItem value="1000">1000 Ticks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-6">
        {/* Live Price */}
        <div className="text-center p-4 bg-secondary/10 rounded-xl border border-secondary/30">
          <p className="text-sm text-muted-foreground mb-1">Live Price</p>
          <p className="text-3xl font-bold font-mono text-secondary">{livePrice}</p>
        </div>

        {/* Digit Grid - Two rows: 0-4 and 5-9 */}
        <div className="space-y-4 py-4">
          {/* First row: digits 0-4 */}
          <div className="grid grid-cols-5 gap-4 justify-items-center">
            {frequencies.filter(f => f.digit <= 4).map((freq) => (
              <DigitCircle
                key={freq.digit}
                digit={freq.digit}
                percentage={freq.percentage}
                rank={freq.rank}
                isActive={currentDigit === freq.digit}
              />
            ))}
          </div>
          {/* Second row: digits 5-9 */}
          <div className="grid grid-cols-5 gap-4 justify-items-center">
            {frequencies.filter(f => f.digit >= 5).map((freq) => (
              <DigitCircle
                key={freq.digit}
                digit={freq.digit}
                percentage={freq.percentage}
                rank={freq.rank}
                isActive={currentDigit === freq.digit}
              />
            ))}
          </div>
        </div>

        {/* Cursor explanation */}
        <p className="text-center text-xs text-destructive opacity-80">
          🔻 = Current digit from latest price
        </p>

        {/* Insights Grid */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-muted/20 rounded-xl p-5 text-center border border-border/30">
            <p className="text-sm text-muted-foreground mb-2">Most Frequent</p>
            <p className="text-2xl font-bold">
              <span className="text-success">{mostFrequent?.digit ?? '-'}</span>
              <span className="text-muted-foreground ml-2 text-lg">
                ({mostFrequent?.percentage.toFixed(1) ?? 0}%)
              </span>
            </p>
          </div>
          <div className="bg-muted/20 rounded-xl p-5 text-center border border-border/30">
            <p className="text-sm text-muted-foreground mb-2">Least Frequent</p>
            <p className="text-2xl font-bold">
              <span className="text-destructive">{leastFrequent?.digit ?? '-'}</span>
              <span className="text-muted-foreground ml-2 text-lg">
                ({leastFrequent?.percentage.toFixed(1) ?? 0}%)
              </span>
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600" />
            <span className="text-muted-foreground">Most Frequent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
            <span className="text-muted-foreground">Second Most</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600" />
            <span className="text-muted-foreground">Second Least</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-red-600" />
            <span className="text-muted-foreground">Least Frequent</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
