import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDigitAnalyzer } from '@/hooks/useDigitAnalyzer';
import { AnalyzerBar } from './AnalyzerBar';
import { PatternGrid } from './PatternGrid';
import { SYMBOLS } from '@/types/trading';
import { cn } from '@/lib/utils';

interface DigitAnalyzerV5Props {
  onRiseFallChange?: (isRiseFall: boolean) => void;
}

export function DigitAnalyzerV5({ onRiseFallChange }: DigitAnalyzerV5Props) {
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

  const isRiseFall = currentAnalysisType === 'risefall';
  const chartUrl = `https://charts.deriv.com/?instrument=${currentSymbol}`;

  // Notify parent when Rise/Fall mode toggles so the page chrome can collapse
  useEffect(() => {
    onRiseFallChange?.(currentAnalysisType === 'risefall');
  }, [currentAnalysisType, onRiseFallChange]);

  const analysisTypeSelect = (
    <Select
      value={currentAnalysisType}
      onValueChange={(v) => setAnalysisType(v as typeof currentAnalysisType)}
    >
      <SelectTrigger className="h-6 text-[10px] px-1.5">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="evenodd" className="text-xs">Even/Odd</SelectItem>
        <SelectItem value="overunder" className="text-xs">Over/Under</SelectItem>
        <SelectItem value="matchesdiffers" className="text-xs">Match/Diff</SelectItem>
        <SelectItem value="risefall" className="text-xs">Rise/Fall</SelectItem>
      </SelectContent>
    </Select>
  );

  const symbolSelect = (
    <Select value={currentSymbol} onValueChange={(v) => changeSymbol(v)}>
      <SelectTrigger className="h-6 text-[10px] px-1.5">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SYMBOLS.map(s => (
          <SelectItem key={s.code} value={s.code} className="text-xs">{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card className="bg-gradient-panel border-border/50 h-full animate-fade-in flex flex-col relative overflow-hidden">
      {isRiseFall ? (
        /* Full-screen interactive chart with a tiny corner mode-switcher */
        <>
          <iframe
            key={chartUrl}
            title="Deriv Chart"
            src={chartUrl}
            className="absolute inset-0 w-full h-full z-0"
            allowFullScreen
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5 items-end pointer-events-none">
            <div className="pointer-events-auto bg-background/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-lg p-1 w-[110px]">
              {analysisTypeSelect}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="p-2 pb-2 space-y-2 flex-none">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-semibold flex items-center gap-2">
                <span>📈</span> Digit Analyzer
              </div>
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium",
                isConnected
                  ? 'bg-success/10 text-success border border-success/30'
                  : 'bg-muted/50 text-muted-foreground'
              )}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                )} />
                <span>{isConnected ? 'Live' : 'Connecting...'}</span>
              </div>
            </div>

            {/* Controls - Compact Row */}
            <div className="flex flex-wrap items-center gap-1">
              <div className="flex-1 min-w-[60px]">{symbolSelect}</div>
              <div className="flex-1 min-w-[70px]">{analysisTypeSelect}</div>
              <div className="w-[52px]">
                <Select
                  value={String(currentTickCount)}
                  onValueChange={(v) => setTickCount(parseInt(v))}
                >
                  <SelectTrigger className="h-6 text-[10px] px-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50" className="text-xs">50</SelectItem>
                    <SelectItem value="120" className="text-xs">120</SelectItem>
                    <SelectItem value="500" className="text-xs">500</SelectItem>
                    <SelectItem value="1000" className="text-xs">1k</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(currentAnalysisType === 'overunder' || currentAnalysisType === 'matchesdiffers') && (
                <div className="w-[44px]">
                  <Select
                    value={String(currentBarrier)}
                    onValueChange={(v) => setBarrier(parseInt(v))}
                  >
                    <SelectTrigger className="h-6 text-[10px] px-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                        <SelectItem key={d} value={String(d)} className="text-xs">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="p-2 pt-0 flex-1 flex flex-col min-h-0">
            {/* Live Price */}
            <div className="text-center p-1 bg-secondary/10 rounded-lg border border-secondary/30 mb-1">
              <p className="text-sm md:text-2xl font-bold font-mono text-secondary">{livePrice}</p>
            </div>

            {/* Bar Charts - Maximized Height */}
            <div className="flex justify-center gap-4 md:gap-16 items-end h-[200px] md:h-auto -mt-2">
              <AnalyzerBar
                value={stats.leftValue}
                label={stats.leftLabel}
                type="positive"
                maxHeight={180}
                width="90px"
              />
              <AnalyzerBar
                value={stats.rightValue}
                label={stats.rightLabel}
                type="negative"
                maxHeight={180}
                width="90px"
              />
            </div>

            {/* Pattern Grid - Compressed */}
            <div className="space-y-1 md:space-y-3 -mt-2">
              <h3 className="text-[10px] md:text-sm font-semibold text-center text-muted-foreground opacity-80">
                Last {currentTickCount} Pattern
              </h3>
              <div className="flex justify-center overflow-x-auto pb-1">
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
          </div>
        </>
      )}
    </Card>
  );
}
