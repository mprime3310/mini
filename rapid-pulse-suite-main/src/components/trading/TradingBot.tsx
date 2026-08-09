import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTradingBot } from '@/hooks/useTradingBot';
import { useSound } from '@/hooks/useSound';
import { TradeTable } from './TradeTable';
import { TradingProgress } from './TradingProgress';
import { cn } from '@/lib/utils';
import { SYMBOLS } from '@/types/trading';
import { Volume2, VolumeX } from 'lucide-react';

export function TradingBot() {
  const [token, setToken] = useState('');
  
  const { isSoundEnabled, toggleSound, playWinSound, playLossSound } = useSound();
  
  const handleSoundPlay = (type: 'win' | 'loss') => {
    if (type === 'win') playWinSound();
    else playLossSound();
  };
  
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
    botState,
    executionSpeed,
    tradeOnEachTick,
    connect,
    disconnect,
    startBot,
    stopBot,
    togglePause,
    clearTrades,
    updateSettings,
    updateExecutionSpeed,
    updateTradeOnEachTick,
  } = useTradingBot({ onSoundPlay: handleSoundPlay });

  // No useEffect needed - sounds handled via onSoundPlay callback

  const totalRuns = trades.length;
  const wins = trades.filter(t => t.profit > 0).length;
  const losses = trades.filter(t => t.profit < 0).length;
  const totalPL = trades.reduce((sum, t) => sum + t.profit, 0);

  const handleConnect = () => {
    if (token.trim()) {
      connect(token.trim());
    }
  };

  const categoryOptions = [
    { value: 'rise_fall', label: 'Rise/Fall' },
    { value: 'matches_differs', label: 'Matches/Differs' },
    { value: 'over_under', label: 'Over/Under' },
    { value: 'even_odd', label: 'Even/Odd' },
  ];

  const getDirectionOptions = () => {
    switch (settings.category) {
      case 'rise_fall': return [{ value: 'rise', label: 'Rise' }, { value: 'fall', label: 'Fall' }];
      case 'matches_differs': return [{ value: 'matches', label: 'Matches' }, { value: 'differs', label: 'Differs' }];
      case 'over_under': return [{ value: 'over', label: 'Over' }, { value: 'under', label: 'Under' }];
      case 'even_odd': return [{ value: 'even', label: 'Even' }, { value: 'odd', label: 'Odd' }];
      default: return [];
    }
  };

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

      {/* Balance Card */}
      <Card className="bg-muted/20 border-border/50">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</p>
              <p className="text-lg font-bold font-mono text-foreground">{balance.toFixed(2)} USD</p>
              <p className="text-[9px] text-muted-foreground font-mono">{accountId || 'Not connected'}</p>
            </div>
            {!isConnected && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  type="password"
                  placeholder="API Token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="h-8 flex-1 sm:w-32 text-xs"
                />
                <Button size="sm" onClick={handleConnect} disabled={isConnecting}>
                  Connect
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="bg-muted/20 border-border/50">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>⚙️</span> Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          {/* Symbol */}
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">Symbol</label>
            <Select 
              value={settings.symbol} 
              onValueChange={(v) => updateSettings({ symbol: v })}
              disabled={isRunning && !isPaused}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
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

          {/* Strategy */}
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-semibold">Trading Strategy</label>
            <Select 
              value={settings.strategy} 
              onValueChange={(v) => updateSettings({ strategy: v as typeof settings.strategy })}
              disabled={isRunning && !isPaused}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
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

          {/* Horizontal Strategy Sequence */}
          {settings.strategy === 'horizontal' && settings.category === 'over_under' && (
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold">Prediction Sequence</label>
              <Input
                placeholder="O4,U6,O3,U7"
                value={settings.predictionSequence}
                onChange={(e) => updateSettings({ predictionSequence: e.target.value })}
                disabled={isRunning && !isPaused}
                className="h-8 text-xs mt-1 font-mono"
              />
              <p className="text-[8px] text-muted-foreground mt-1">Format: O=Over, U=Under + digit (e.g., O4,U6)</p>
            </div>
          )}

          {/* Alternate Strategy Indicator */}
          {settings.strategy === 'alternate' && settings.category === 'even_odd' && (
            <div className="bg-secondary/10 border border-secondary/30 rounded p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Next Direction</p>
              <p className="text-sm font-bold text-secondary">
                {session.alternate.nextDirection === 0 ? 'Even' : 'Odd'}
              </p>
            </div>
          )}

          {/* Contract & Direction */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold">Contract</label>
              <Select 
                value={settings.category} 
                onValueChange={(v) => updateSettings({ category: v as typeof settings.category })}
                disabled={isRunning && !isPaused}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
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
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold">Direction</label>
              <Select 
                value={settings.direction} 
                onValueChange={(v) => updateSettings({ direction: v })}
                disabled={(isRunning && !isPaused) || settings.strategy !== 'manual'}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getDirectionOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold">Digit</label>
              <Select
                value={String(settings.barrier)}
                onValueChange={(v) => updateSettings({ barrier: parseInt(v) })}
                disabled={(isRunning && !isPaused) || settings.strategy === 'horizontal'}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5,6,7,8,9].map(d => (
                    <SelectItem key={d} value={String(d)} className="text-xs">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stake & Martingale */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold">Stake ($)</label>
              <Input
                type="number"
                step={0.01}
                min={0.35}
                value={settings.stake}
                onChange={(e) => updateSettings({ stake: parseFloat(e.target.value) || 1 })}
                disabled={isRunning && !isPaused}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold">Martingale</label>
              <Input
                type="number"
                step={0.1}
                min={1}
                value={settings.martingale}
                onChange={(e) => updateSettings({ martingale: parseFloat(e.target.value) || 2 })}
                disabled={isRunning && !isPaused}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold">Ticks</label>
              <Input
                type="number"
                min={settings.category === 'rise_fall' ? 5 : 1}
                max={settings.category === 'rise_fall' ? 10 : 5}
                value={settings.ticks}
                onChange={(e) => updateSettings({ ticks: parseInt(e.target.value) || 1 })}
                disabled={isRunning && !isPaused}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* Stop Conditions */}
          <div className="bg-muted/30 rounded p-2 space-y-2">
            <p className="text-[9px] uppercase text-muted-foreground font-semibold">Stop Conditions</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-muted-foreground">Take Profit ($)</label>
                <Input
                  type="number"
                  value={settings.takeProfit}
                  onChange={(e) => updateSettings({ takeProfit: parseFloat(e.target.value) || 0 })}
                  disabled={isRunning && !isPaused}
                  className="h-7 text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Stop Loss ($)</label>
                <Input
                  type="number"
                  value={settings.stopLoss}
                  onChange={(e) => updateSettings({ stopLoss: parseFloat(e.target.value) || 0 })}
                  disabled={isRunning && !isPaused}
                  className="h-7 text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Max Consec. Losses</label>
                <Input
                  type="number"
                  min={0}
                  value={settings.maxConsecutiveLosses}
                  onChange={(e) => updateSettings({ maxConsecutiveLosses: parseInt(e.target.value) || 0 })}
                  disabled={isRunning && !isPaused}
                  className="h-7 text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Max Total Losses</label>
                <Input
                  type="number"
                  min={0}
                  value={settings.maxTotalLosses}
                  onChange={(e) => updateSettings({ maxTotalLosses: parseInt(e.target.value) || 0 })}
                  disabled={isRunning && !isPaused}
                  className="h-7 text-xs mt-0.5"
                />
              </div>
            </div>
          </div>

          {/* Execution Speed Control */}
          <div className="bg-primary/5 border border-primary/20 rounded p-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[9px] uppercase text-muted-foreground font-semibold">
                Execution Speed
              </label>
              <span className="text-xs font-bold font-mono text-primary">
                {executionSpeed === 0 ? 'MAX (0ms)' : `${executionSpeed}ms`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              value={executionSpeed}
              onChange={(e) => updateExecutionSpeed(parseInt(e.target.value))}
              disabled={tradeOnEachTick}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50"
            />
            <p className="text-[8px] text-muted-foreground">
              0ms = immediate execution | 50ms = safer with delays
            </p>
            
            {/* Trade on Each Tick Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div>
                <label className="text-[9px] uppercase text-muted-foreground font-semibold">
                  Trade on Each Tick
                </label>
                <p className="text-[8px] text-muted-foreground">
                  Execute on every market tick
                </p>
              </div>
              <Switch
                checked={tradeOnEachTick}
                onCheckedChange={updateTradeOnEachTick}
                disabled={isRunning && !isPaused}
              />
            </div>
          </div>

          {/* Bot State Indicator */}
          <div className={cn(
            "rounded p-2 text-center border",
            botState === 'RUNNING' ? 'bg-success/10 border-success/30' :
            botState === 'STOPPING' ? 'bg-warning/10 border-warning/30' :
            botState === 'STOPPED' ? 'bg-destructive/10 border-destructive/30' :
            'bg-muted/30 border-border/30'
          )}>
            <p className="text-[9px] uppercase text-muted-foreground">State Machine</p>
            <p className={cn(
              "text-sm font-bold",
              botState === 'RUNNING' ? 'text-success' :
              botState === 'STOPPING' ? 'text-warning' :
              botState === 'STOPPED' ? 'text-destructive' :
              'text-muted-foreground'
            )}>
              {botState}
            </p>
          </div>

          {/* Pause Notice */}
          {isPaused && (
            <div className="bg-warning/10 border border-warning/30 rounded p-2 text-center">
              <p className="text-[10px] text-warning">⏸ Bot paused - modify settings and resume</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <span className={cn(
              "text-xs font-mono",
              session.sessionPnL >= 0 ? 'text-success' : 'text-destructive'
            )}>
              PnL: {session.sessionPnL >= 0 ? '+' : ''}{session.sessionPnL.toFixed(2)}
            </span>
            <div className="flex-1" />
            {!isRunning ? (
              <Button 
                size="sm" 
                className="bg-success hover:bg-success/90"
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
                    "border-warning text-warning hover:bg-warning/10",
                    isPaused && "bg-success/10 border-success text-success"
                  )}
                  onClick={togglePause}
                >
                  <span className="mr-1">{isPaused ? '▶' : '⏸'}</span> {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button 
                  size="sm" 
                  className="bg-destructive hover:bg-destructive/90"
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
        <CardHeader className="p-3 pb-2">
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
        <CardContent className="p-3 pt-0 space-y-3">
          <TradingProgress step={tradingStep} lastResult={lastTradeResult} />
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

      {/* Footer */}
      <div className="text-center text-[9px] text-muted-foreground pt-2 border-t border-border/50">
        MirukaG Pro v5 | State Machine Architecture | Speed: {executionSpeed}ms
      </div>
    </div>
  );
}
