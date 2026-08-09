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
    <div className="grid grid-cols-[280px_1fr] gap-5 h-full animate-fade-in">
      {/* Control Panel */}
      <Card className="bg-gradient-panel border-border/50 h-fit">
        <CardHeader className="p-5 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <span>⚙️</span> Scanner Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          {/* Analysis Mode */}
          <div className="space-y-2">
            <label className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
              Analysis Mode
            </label>
            <Select 
              value={analysisType} 
              onValueChange={(v) => setAnalysisType(v as 'evenodd' | 'overunder')}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evenodd">Even/Odd Analysis</SelectItem>
                <SelectItem value="overunder">Over/Under Analysis</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target Digit (for Over/Under) */}
          {analysisType === 'overunder' && (
            <div className="space-y-2">
              <label className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
                Target Number
              </label>
              <Select 
                value={String(targetDigit)} 
                onValueChange={(v) => setTargetDigit(parseInt(v))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Analysis Window */}
          <div className="space-y-2">
            <label className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
              Analysis Window
            </label>
            <Select 
              value={String(windowSize)} 
              onValueChange={(v) => setWindowSize(parseInt(v))}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 Ticks</SelectItem>
                <SelectItem value="120">120 Ticks</SelectItem>
                <SelectItem value="250">250 Ticks</SelectItem>
                <SelectItem value="500">500 Ticks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase text-muted-foreground font-semibold tracking-wide">
                Threshold (Min: 55%)
              </label>
              <span className="text-base font-bold text-success font-mono">{threshold}%</span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={(v) => setThreshold(v[0])}
              min={55}
              max={95}
              step={1}
              className="w-full"
            />
          </div>

          {/* Start/Stop Button */}
          <Button
            className={cn(
              "w-full h-11 font-bold",
              isRunning 
                ? 'bg-destructive hover:bg-destructive/90' 
                : 'bg-gradient-primary hover:opacity-90'
            )}
            onClick={isRunning ? stop : start}
          >
            {isRunning ? '⏹ STOP SCANNER' : '▶ START SCANNER'}
          </Button>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            <div className="bg-card/50 rounded-lg p-3 text-center border border-border/30 hover:border-primary/50 transition-colors">
              <div className="text-xl font-bold text-success font-mono">{activeCount}</div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Active Signals</div>
            </div>
            <div className="bg-card/50 rounded-lg p-3 text-center border border-border/30 hover:border-primary/50 transition-colors">
              <div className="text-xl font-bold font-mono">{avgConfidence}%</div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Avg Confidence</div>
            </div>
            <div className="bg-card/50 rounded-lg p-3 text-center border border-border/30 hover:border-primary/50 transition-colors">
              <div className="text-xl font-bold font-mono">{uptime}</div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Uptime</div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-4 p-4 bg-muted/20 rounded-lg border border-border/30">
            <div className="text-xs text-muted-foreground leading-relaxed">
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
      <Card className="bg-gradient-panel border-border/50 flex flex-col">
        <CardHeader className="p-5 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <span>📊</span> Active Volatility Signals (≥{threshold}%)
            </CardTitle>
            
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-lg font-bold font-mono">{activeCount}</span>
                <span className="text-[10px] text-muted-foreground">Active Signals</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold font-mono">
                  {lastUpdate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '--:--:--'}
                </span>
                <span className="text-[10px] text-muted-foreground">Last Update</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold font-mono">1s</span>
                <span className="text-[10px] text-muted-foreground">Refresh Rate</span>
              </div>
              
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium",
                isConnected 
                  ? 'bg-success/10 text-success border border-success/30' 
                  : 'bg-muted/50 text-muted-foreground'
              )}>
                {isRunning ? (
                  <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-current" />
                )}
                <span>{isRunning ? 'Scanning' : 'Ready'}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScannerTable signals={signals} isLoading={isConnected && signals.length === 0} />
        </CardContent>
      </Card>
    </div>
  );
}
