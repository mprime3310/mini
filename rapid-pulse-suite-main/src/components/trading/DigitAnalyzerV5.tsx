import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useDigitAnalyzer } from '@/hooks/useDigitAnalyzer';
import { AnalyzerBar } from './AnalyzerBar';
import { PatternGrid } from './PatternGrid';
import { SYMBOLS } from '@/types/trading';
import { cn } from '@/lib/utils';

export function DigitAnalyzerV5() {
  const {
    isConnected,
    currentSymbol,
    currentTickCount,
    currentAnalysisType,
    currentBarrier,
    livePrice,
    stats,
    connect,
    setTickCount,
    setAnalysisType,
    setBarrier,
    changeSymbol,
  } = useDigitAnalyzer();

  useEffect(() => {
    connect();
  }, []);

  return (
    <Card className="bg-gradient-panel border-border/50 h-full animate-fade-in">
      <CardHeader className="p-3 md:p-5 pb-3 md:pb-4 space-y-3 md:space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 md:gap-4">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <span>📈</span> Digit Analyzer v5.1
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <div className="space-y-2">
            <label className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
              Symbol
            </label>
            <Select value={currentSymbol} onValueChange={(v) => changeSymbol(v)}>
              <SelectTrigger className="h-9">
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
              Analysis Type
            </label>
            <Select 
              value={currentAnalysisType} 
              onValueChange={(v) => setAnalysisType(v as typeof currentAnalysisType)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evenodd">Even/Odd</SelectItem>
                <SelectItem value="overunder">Over/Under</SelectItem>
                <SelectItem value="matchesdiffers">Matches/Differs</SelectItem>
                <SelectItem value="risefall">Rise/Fall</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
              Tick Count
            </label>
            <Select 
              value={String(currentTickCount)} 
              onValueChange={(v) => setTickCount(parseInt(v))}
            >
              <SelectTrigger className="h-9">
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
          {(currentAnalysisType === 'overunder' || currentAnalysisType === 'matchesdiffers') && (
            <div className="space-y-2">
              <label className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
                Barrier
              </label>
              <Input
                type="number"
                min={0}
                max={9}
                value={currentBarrier}
                onChange={(e) => setBarrier(parseInt(e.target.value) || 5)}
                className="h-9"
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 md:p-5 pt-0 space-y-4 md:space-y-6">
        {/* Live Price */}
        <div className="text-center p-2 md:p-3 bg-secondary/10 rounded-xl border border-secondary/30">
          <p className="text-lg md:text-2xl font-bold font-mono text-secondary">{livePrice}</p>
        </div>

        {/* Bar Charts */}
        <div className="flex justify-center gap-8 md:gap-16">
          <AnalyzerBar
            value={stats.leftValue}
            label={stats.leftLabel}
            type="positive"
          />
          <AnalyzerBar
            value={stats.rightValue}
            label={stats.rightLabel}
            type="negative"
          />
        </div>

        {/* Pattern Grid */}
        <div className="space-y-2 md:space-y-3">
          <h3 className="text-xs md:text-sm font-semibold text-center text-muted-foreground">
            Last {currentTickCount} Pattern
          </h3>
          <div className="flex justify-center overflow-x-auto">
            <PatternGrid pattern={stats.pattern} columns={15} />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap text-[10px] md:text-xs border-t border-border/30 pt-3 md:pt-4">
          <div className="flex items-center gap-1 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-primary/90" />
            <span className="text-muted-foreground">{stats.leftLabel}</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-destructive/90" />
            <span className="text-muted-foreground">{stats.rightLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
