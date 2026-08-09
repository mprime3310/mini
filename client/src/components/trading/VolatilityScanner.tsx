import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useVolatilityScanner } from '@/hooks/useVolatilityScanner';
import { ScannerTable } from './ScannerTable';
import { cn } from '@/lib/utils';

export function VolatilityScanner() {
  const [threshold, setThreshold] = useState(55);
  const [analysisType, setAnalysisType] = useState<'evenodd' | 'overunder'>('evenodd');
  const [targetDigit, setTargetDigit] = useState(5);
  const [windowSize, setWindowSize] = useState(120);

  const {
    isRunning,
    isConnected,
    signals,
    activeCount,
    lastUpdate,
    startTime,
    start,
    stop,
  } = useVolatilityScanner({
    threshold,
    analysisType,
    targetDigit,
    windowSize,
  });

  const getUptime = () => {
    if (!startTime) return '00:00';
    const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const [uptime, setUptime] = useState('00:00');

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(getUptime());
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const avgConfidence = signals.length > 0
    ? (signals.reduce((sum, s) => sum + s.percentage, 0) / signals.length).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col md:grid md:grid-cols-[280px_1fr] gap-2 md:gap-5 h-full animate-fade-in min-h-0">
      {/* Control Panel */}
      <Card className="bg-gradient-panel border-border/50 h-fit flex-none">
        <CardHeader className="p-2.5 md:p-3 pb-1.5 md:pb-2">
          <CardTitle className="text-xs md:text-sm flex items-center gap-2">
            <span>⚙️</span> Scanner Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2.5 md:p-3 pt-0 space-y-1.5 md:space-y-3">
          <div className="flex flex-wrap items-center gap-1 md:gap-3 mb-1 md:mb-2">
            {/* Analysis Mode */}
            <div className="flex-1 min-w-[70px]">
              <Select
                value={analysisType}
                onValueChange={(v) => setAnalysisType(v as 'evenodd' | 'overunder')}
              >
                <SelectTrigger className="h-6 md:h-7 text-[10px] md:text-xs px-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="evenodd" className="text-xs md:text-sm">Even/Odd</SelectItem>
                  <SelectItem value="overunder" className="text-xs md:text-sm">Over/Under</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Digit (for Over/Under) */}
            {analysisType === 'overunder' && (
              <div className="w-[40px]">
                <Select
                  value={String(targetDigit)}
                  onValueChange={(v) => setTargetDigit(parseInt(v))}
                >
                  <SelectTrigger className="h-6 md:h-7 text-[10px] md:text-xs px-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                      <SelectItem key={d} value={String(d)} className="text-xs md:text-sm">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Analysis Window */}
            <div className="w-[58px]">
              <Select
                value={String(windowSize)}
                onValueChange={(v) => setWindowSize(parseInt(v))}
              >
                <SelectTrigger className="h-6 md:h-7 text-[10px] md:text-xs px-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50" className="text-xs md:text-sm">50 Tks</SelectItem>
                  <SelectItem value="120" className="text-xs md:text-sm">120 Tks</SelectItem>
                  <SelectItem value="250" className="text-xs md:text-sm">250 Tks</SelectItem>
                  <SelectItem value="500" className="text-xs md:text-sm">500 Tks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Threshold */}
            <div className="flex-1 min-w-[90px] flex items-center gap-1.5 border border-border/30 rounded px-1.5 h-6 md:h-7 bg-card">
              <span className="text-[9px] uppercase text-muted-foreground font-semibold">Min:</span>
              <span className="text-[11px] md:text-xs font-bold text-success font-mono">{threshold}%</span>
              <Slider
                value={[threshold]}
                onValueChange={(v) => setThreshold(v[0])}
                min={55}
                max={95}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* Start/Stop Button */}
          <Button
            className={cn(
              "w-full h-7 md:h-8 font-bold text-[10px] md:text-xs",
              isRunning
                ? 'bg-destructive hover:bg-destructive/90'
                : 'bg-gradient-primary hover:opacity-90'
            )}
            onClick={isRunning ? stop : start}
          >
            {isRunning ? '⏹ STOP SCANNER' : '▶ START SCANNER'}
          </Button>

          {/* Stats Grid - Compact Line */}
          <div className="flex items-center justify-between gap-2 md:gap-3 pt-1 md:pt-3 border-t border-border/30 mt-0.5 md:mt-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase">Active:</span>
              <span className="text-sm font-bold text-success font-mono">{activeCount}</span>
            </div>
            <div className="h-3 w-px bg-border/50" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase">Conf:</span>
              <span className="text-sm font-bold font-mono">{avgConfidence}%</span>
            </div>
            <div className="h-3 w-px bg-border/50" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase">Time:</span>
              <span className="text-sm font-bold font-mono">{uptime}</span>
            </div>
          </div>

          {/* Info Box - Hidden on mobile */}
          <div className="hidden md:block mt-1.5 md:mt-2 p-2 md:p-3 bg-muted/20 rounded-lg border border-border/30">
            <div className="text-[10px] md:text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">⚡ Ultra-Fast Scanning</strong><br />
              • Shows only volatilities ≥ {threshold}%<br />
              • Refreshes every 1 second<br />
              • Volatilities appear/disappear automatically<br />
              • Deviation shows change from last update
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scanner Results */}
      <Card className="bg-gradient-panel border-border/50 flex flex-col flex-1 min-h-0">
        <CardHeader className="p-2.5 md:p-3 border-b border-border/50 flex-none">
          <div className="flex items-center justify-between flex-wrap gap-2 md:gap-4">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <span>📊</span> Active Volatility Signals (≥{threshold}%)
            </CardTitle>

            <div className="flex items-center gap-3 md:gap-6">
              <div className="flex flex-col">
                <span className="text-sm md:text-lg font-bold font-mono">{activeCount}</span>
                <span className="text-[8px] md:text-[10px] text-muted-foreground">Active Signals</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm md:text-lg font-bold font-mono">
                  {lastUpdate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '--:--:--'}
                </span>
                <span className="text-[8px] md:text-[10px] text-muted-foreground">Last Update</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm md:text-lg font-bold font-mono">1s</span>
                <span className="text-[8px] md:text-[10px] text-muted-foreground">Refresh Rate</span>
              </div>

              <div className={cn(
                "flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-md text-xs md:text-sm font-medium",
                isConnected
                  ? 'bg-success/10 text-success border border-success/30'
                  : 'bg-muted/50 text-muted-foreground'
              )}>
                {isRunning ? (
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-current animate-pulse" />
                ) : (
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-current" />
                )}
                <span>{isRunning ? 'Scanning' : 'Ready'}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 overflow-hidden relative">
          <div className="absolute inset-0 overflow-auto">
            <ScannerTable signals={signals} isLoading={isConnected && signals.length === 0} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
