import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTradingBot } from '@/hooks/useTradingBot';
import { useSound } from '@/hooks/useSound';
import { TradeTable } from './TradeTable';
import { TradingProgress, TradingProgressHandle } from './TradingProgress';
import { cn } from '@/lib/utils';
import { SYMBOLS, DIRECTION_OPTIONS } from '@/types/trading';
import { Volume2, VolumeX } from 'lucide-react';

export function TradingBot() {
  const [token, setToken] = useState('');
  const [appId, setAppId] = useState('');

  const { isSoundEnabled, toggleSound, playWinSound, playLossSound } = useSound();

  const handleSoundPlay = (type: 'win' | 'loss') => {
    if (type === 'win') playWinSound();
    else playLossSound();
  };

  const progressRef = useRef<TradingProgressHandle>(null);

  const handleTick = useCallback((current: number, total: number) => {
    progressRef.current?.setTick(current, total);
  }, []);

  const {
    isConnected,
    isConnecting,
    isAuthorized,
    isRunning,
    isPaused,
    balance,
    accountId,
    trades,
    session,
    settings,
    tradingStep,
    lastTradeResult,
    connect,
    disconnect,
    startBot,
    stopBot,
    togglePause,
    clearTrades,
    updateSettings,
  } = useTradingBot({
    onSoundPlay: handleSoundPlay,
    onTick: handleTick
  });

  // No useEffect needed - sounds handled via onSoundPlay callback

  const totalRuns = trades.length;
  const wins = trades.filter(t => t.profit > 0).length;
  const losses = trades.filter(t => t.profit < 0).length;
  const totalPL = trades.reduce((sum, t) => sum + t.profit, 0);

  const handleConnect = () => {
    if (token.trim() && appId.trim()) {
      connect(token.trim(), appId.trim());
    }
  };

  const categoryOptions = [
    { value: 'rise_fall', label: 'Rise/Fall' },
    { value: 'matches_differs', label: 'Matches/Differs' },
    { value: 'over_under', label: 'Over/Under' },
    { value: 'even_odd', label: 'Even/Odd' },
  ];

  // Direction options are derived from the currently selected contract type
  const directionOptions = DIRECTION_OPTIONS[settings.category] || [];
  const directionLocked = settings.strategy !== 'manual' || (isRunning && !isPaused);

  const strategyOptions = [
    { value: 'manual', label: 'Manual' },
    { value: 'horizontal', label: 'Horizontal (O/U)' },
    { value: 'alternate', label: 'Alternate (E/O)' },
  ];

  // Group symbols by category
  const groupedSymbols = SYMBOLS.reduce((acc, s) => {
    const group = s.group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(s);
    return acc;
  }, {} as Record<string, typeof SYMBOLS>);

  return (
    <div className="space-y-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h2 className="text-sm font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Ultra-Fast Bot v4
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isSoundEnabled ? 'bg-success/20 text-success' : 'bg-muted/50 text-muted-foreground'
            )}
            title={isSoundEnabled ? 'Sound On' : 'Sound Off'}
          >
            {isSoundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <div className="flex items-center gap-2 text-[10px] bg-muted/50 px-2 py-1 rounded-full">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? 'bg-success' : isConnecting ? 'bg-secondary animate-pulse' : 'bg-destructive'
            )} />
            <span className="text-muted-foreground">
              {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Balance + Connection */}
      <Card className="bg-muted/20 border-border/50">
        <CardContent className="px-3 py-2">
          <div className="flex flex-row items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Balance</p>
              <p className="text-sm font-bold font-mono text-foreground leading-tight">{balance.toFixed(2)} USD</p>
              <p className="text-[8px] text-muted-foreground font-mono truncate hidden sm:block">{accountId || 'Not connected'}</p>
            </div>
            {!isConnected && (
              <div className="flex items-center gap-1.5 flex-1 lg:flex-none min-w-0">
                <Input
                  type="text"
                  placeholder="App ID"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="h-7 flex-1 min-w-0 text-xs"
                />
                <Input
                  type="password"
                  placeholder="API Token (pat_...)"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="h-7 flex-1 min-w-[100px] text-xs"
                />
                <Button size="sm" onClick={handleConnect} disabled={isConnecting} className="h-7 px-3">
                  Connect
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="bg-muted/20 border-border/50">
        <CardHeader className="px-2.5 py-1.5">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>⚙️</span> Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2.5 py-1.5 space-y-1.5">
          {/* Symbol */}
          <div>
            <label className="block mb-0.5 text-[9px] uppercase text-muted-foreground font-semibold">Symbol</label>
            <Select
              value={settings.symbol}
              onValueChange={(v) => updateSettings({ symbol: v })}
              disabled={isRunning && !isPaused}
            >
              <SelectTrigger className="h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedSymbols).map(([group, symbols]) => (
                  <div key={group}>
                    <div className="px-2 py-1 text-[10px] font-semibold text-secondary">{group}</div>
                    {symbols.map(s => (
                      <SelectItem key={s.code} value={s.code} className="text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ROW 1: Strategy | Contract | Digit */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="min-w-0">
              <label className="block mb-0.5 text-[9px] uppercase text-muted-foreground font-semibold">Trading Strategy</label>
              <Select
                value={settings.strategy}
                onValueChange={(v) => updateSettings({ strategy: v as typeof settings.strategy })}
                disabled={isRunning && !isPaused}
              >
                <SelectTrigger className="h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {strategyOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <label className="block mb-0.5 text-[9px] uppercase text-muted-foreground font-semibold">Contract</label>
              <Select
                value={settings.category}
                onValueChange={(v) => updateSettings({ category: v as typeof settings.category })}
                disabled={isRunning && !isPaused}
              >
                <SelectTrigger className="h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <label className="block mb-0.5 text-[9px] uppercase text-muted-foreground font-semibold">Digit</label>
              <Select
                value={String(settings.barrier)}
                onValueChange={(v) => updateSettings({ barrier: parseInt(v) })}
                disabled={(isRunning && !isPaused) || settings.strategy === 'horizontal'}
              >
                <SelectTrigger className="h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                    <SelectItem key={d} value={String(d)} className="text-xs">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ROW 2: Stake | Take Profit | Martingale | Ticks */}
          <div className="grid grid-cols-4 gap-1.5">
            <Input
              type="number"
              step={0.01}
              min={0.35}
              value={settings.stake || ''}
              placeholder="Stake"
              title="Stake ($)"
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                updateSettings({ stake: value });
              }}
              disabled={isRunning && !isPaused}
              className="h-6 text-xs"
            />
            <Input
              type="number"
              value={settings.takeProfit || ''}
              placeholder="Take Profit"
              title="Take Profit ($)"
              onChange={(e) => updateSettings({ takeProfit: parseFloat(e.target.value) || 0 })}
              disabled={isRunning && !isPaused}
              className="h-6 text-xs"
            />
            <Input
              type="number"
              step={0.1}
              min={1}
              value={settings.martingale || ''}
              placeholder="Martingale"
              title="Martingale"
              onChange={(e) => updateSettings({ martingale: parseFloat(e.target.value) || 2 })}
              disabled={isRunning && !isPaused}
              className="h-6 text-xs"
            />
            <Input
              type="number"
              min={1}
              max={settings.category === 'rise_fall' ? 10 : 5}
              value={settings.ticks || ''}
              placeholder="Ticks"
              title="Ticks"
              onChange={(e) => updateSettings({ ticks: parseInt(e.target.value) || 1 })}
              disabled={isRunning && !isPaused}
              className="h-6 text-xs"
            />
          </div>

          {/* ROW 3: Stop Loss | Max Consecutive Losses | Max Total Losses */}
          <div className="grid grid-cols-3 gap-1.5">
            <Input
              type="number"
              value={settings.stopLoss || ''}
              placeholder="Stop Loss"
              title="Stop Loss ($)"
              onChange={(e) => updateSettings({ stopLoss: parseFloat(e.target.value) || 0 })}
              disabled={isRunning && !isPaused}
              className="h-6 text-xs"
            />
            <Input
              type="number"
              min={0}
              value={settings.maxConsecutiveLosses || ''}
              placeholder="Max Con"
              title="Max Consecutive Losses"
              onChange={(e) => updateSettings({ maxConsecutiveLosses: parseInt(e.target.value) || 0 })}
              disabled={isRunning && !isPaused}
              className="h-6 text-xs"
            />
            <Input
              type="number"
              min={0}
              value={settings.maxTotalLosses || ''}
              placeholder="Max Loss"
              title="Max Total Losses"
              onChange={(e) => updateSettings({ maxTotalLosses: parseInt(e.target.value) || 0 })}
              disabled={isRunning && !isPaused}
              className="h-6 text-xs"
            />
          </div>

          {/* Horizontal Strategy Sequence */}
          {settings.strategy === 'horizontal' && settings.category === 'over_under' && (
            <div>
              <label className="block mb-0.5 text-[9px] uppercase text-muted-foreground font-semibold">Prediction Sequence</label>
              <Input
                placeholder="O4,U6,O3,U7"
                value={settings.predictionSequence}
                onChange={(e) => updateSettings({ predictionSequence: e.target.value })}
                disabled={isRunning && !isPaused}
                className="h-6 text-xs mt-0.5 font-mono"
              />
              <p className="text-[8px] text-muted-foreground mt-1">Format: O=Over, U=Under + digit (e.g., O4,U6)</p>
            </div>
          )}

          {/* Alternate Strategy Indicator */}
          {settings.strategy === 'alternate' && settings.category === 'even_odd' && (
            <div className="bg-secondary/10 border border-secondary/30 rounded px-2 py-1 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Next Direction</p>
              <p className="text-xs font-bold text-secondary">
                {session.alternate.nextDirection === 0 ? 'Even' : 'Odd'}
              </p>
            </div>
          )}

          {/* Pause Notice */}
          {isPaused && (
            <div className="bg-warning/10 border border-warning/30 rounded p-2 text-center">
              <p className="text-[10px] text-warning">⏸ Bot paused - modify settings and resume</p>
            </div>
          )}

          {/* PnL + Direction + Controls */}
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/50 flex-wrap">
            <span className={cn(
              "text-xs font-mono font-bold",
              session.sessionPnL >= 0 ? 'text-success' : 'text-destructive'
            )}>
              PnL: {session.sessionPnL >= 0 ? '+' : ''}{session.sessionPnL.toFixed(2)}
            </span>
            <span className="text-[9px] uppercase text-muted-foreground font-semibold">Direction</span>
            <div className="flex items-center gap-1 flex-wrap">
              {directionOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (!directionLocked) updateSettings({ direction: opt.value });
                  }}
                  disabled={directionLocked}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border transition-colors",
                    settings.direction === opt.value
                      ? "bg-primary border-primary text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
                      : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted",
                    directionLocked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {!isRunning ? (
              <Button
                size="sm"
                className="h-7 bg-success hover:bg-success/90"
                onClick={startBot}
                disabled={!isAuthorized}
              >
                <span className="mr-1">▶</span> Start
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-7 border-warning text-warning hover:bg-warning/10",
                    isPaused && "bg-success/10 border-success text-success"
                  )}
                  onClick={togglePause}
                >
                  <span className="mr-1">{isPaused ? '▶' : '⏸'}</span> {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  size="sm"
                  className="h-7 bg-destructive hover:bg-destructive/90"
                  onClick={stopBot}
                >
                  <span className="mr-1">⏹</span> Stop
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Trading Card */}
      <Card className="bg-muted/20 border-border/50">
        <CardHeader className="px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Live Trading</CardTitle>
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] font-semibold",
              isRunning
                ? isPaused
                  ? 'bg-warning/20 text-warning'
                  : 'bg-success/20 text-success'
                : 'bg-muted text-muted-foreground'
            )}>
              {isRunning ? isPaused ? 'Paused' : 'Running' : 'Stopped'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-2.5 py-1.5 space-y-2">
          <TradingProgress
            ref={progressRef}
            step={tradingStep}
            lastResult={lastTradeResult}
          />
          <TradeTable trades={trades} onClear={clearTrades} />

          {/* Stats Footer */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
            <div className="text-center p-2 bg-muted/20 rounded">
              <div className="text-sm font-bold">{totalRuns}</div>
              <div className="text-[8px] text-muted-foreground">Runs</div>
            </div>
            <div className="text-center p-2 bg-muted/20 rounded">
              <div className="text-sm font-bold text-success">{wins}</div>
              <div className="text-[8px] text-muted-foreground">Wins</div>
            </div>
            <div className="text-center p-2 bg-muted/20 rounded">
              <div className="text-sm font-bold text-destructive">{losses}</div>
              <div className="text-[8px] text-muted-foreground">Losses</div>
            </div>
            <div className="text-center p-2 bg-muted/20 rounded">
              <div className={cn(
                "text-sm font-bold",
                totalPL >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
              </div>
              <div className="text-[8px] text-muted-foreground">P/L</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-[9px] text-muted-foreground pt-2 border-t border-border/50">
        MG Capital Pro v5 | State Machine Architecture
      </div>
    </div>
  );
}
