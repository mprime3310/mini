import { useState, useCallback, useRef, useEffect } from 'react';
import { Trade, TradingSession, BotSettings } from '@/types/trading';

interface UseTradingBotConfig {
  onTradeComplete?: (trade: Trade) => void;
  onBalanceUpdate?: (balance: number) => void;
  onSoundPlay?: (type: 'win' | 'loss') => void;
}

// State machine states
type BotState = 'IDLE' | 'RUNNING' | 'STOPPING' | 'STOPPED';

export function useTradingBot(config: UseTradingBotConfig = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reqIdRef = useRef(1);
  const currentProposalRef = useRef<string | null>(null);
  const currentContractRef = useRef<string | null>(null);
  const currentTradeRef = useRef<Partial<Trade> | null>(null);
  
  // STATE MACHINE - Critical for preventing unwanted trades
  const botStateRef = useRef<BotState>('IDLE');
  const orderInFlightRef = useRef(false); // Lock for preventing concurrent orders
  const stopRequestedRef = useRef(false); // Hard kill switch
  const lastTradeTimeRef = useRef(0); // High-resolution timing
  
  // Pending callbacks/timers to clear on stop
  const pendingTimersRef = useRef<Set<number>>(new Set());

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [balance, setBalance] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradingStep, setTradingStep] = useState<'idle' | 'proposing' | 'settling' | 'ready'>('idle');
  const [lastTradeResult, setLastTradeResult] = useState<'win' | 'loss' | null>(null);
  const [executionSpeed, setExecutionSpeed] = useState(0); // 0-50ms speed control
  const [botState, setBotState] = useState<BotState>('IDLE');

  const [session, setSession] = useState<TradingSession>({
    sessionPnL: 0,
    consecutiveLosses: 0,
    totalLosses: 0,
    currentStake: 1,
    strategy: 'manual',
    horizontal: { sequence: [], currentIndex: 0 },
    alternate: { nextDirection: 0 },
  });

  const [tradeOnEachTick, setTradeOnEachTick] = useState(false);

  const [settings, setSettings] = useState<BotSettings>({
    symbol: 'R_100',
    category: 'matches_differs',
    direction: 'matches',
    barrier: 5,
    ticks: 1,
    stake: 1,
    martingale: 2,
    takeProfit: 50,
    stopLoss: 100,
    maxConsecutiveLosses: 3,
    maxTotalLosses: 10,
    strategy: 'manual',
    predictionSequence: 'O4,U6,O3,U7',
  });

  const tradeOnEachTickRef = useRef(tradeOnEachTick);
  useEffect(() => { tradeOnEachTickRef.current = tradeOnEachTick; }, [tradeOnEachTick]);

  // Refs for avoiding stale closures
  const isRunningRef = useRef(isRunning);
  const isPausedRef = useRef(isPaused);
  const isAuthorizedRef = useRef(isAuthorized);
  const balanceRef = useRef(balance);
  const sessionRef = useRef(session);
  const settingsRef = useRef(settings);
  const executionSpeedRef = useRef(executionSpeed);

  // Keep refs in sync
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isAuthorizedRef.current = isAuthorized; }, [isAuthorized]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { executionSpeedRef.current = executionSpeed; }, [executionSpeed]);

  // Safe timer with tracking
  const safeSetTimeout = useCallback((fn: () => void, delay: number): number => {
    const id = window.setTimeout(() => {
      pendingTimersRef.current.delete(id);
      // Double-check state before executing
      if (botStateRef.current === 'RUNNING' && !stopRequestedRef.current) {
        fn();
      }
    }, delay);
    pendingTimersRef.current.add(id);
    return id;
  }, []);

  // Clear all pending timers
  const clearAllPendingTimers = useCallback(() => {
    pendingTimersRef.current.forEach(id => window.clearTimeout(id));
    pendingTimersRef.current.clear();
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = { ...data, req_id: reqIdRef.current++ };
      wsRef.current.send(JSON.stringify(message));
      console.log('[BOT] Sent:', data.proposal ? 'proposal' : data.buy ? 'buy' : data.authorize ? 'authorize' : 'other');
      return true;
    }
    return false;
  }, []);

  // HARD STOP - immediate kill switch
  const hardStop = useCallback(() => {
    console.log('[BOT] HARD STOP triggered');
    stopRequestedRef.current = true;
    botStateRef.current = 'STOPPING';
    setBotState('STOPPING');
    
    // Clear all pending timers immediately
    clearAllPendingTimers();
    
    // Allow any in-flight order to complete but block new trades
    orderInFlightRef.current = false;
    
    // Transition to STOPPED after brief delay
    window.setTimeout(() => {
      botStateRef.current = 'STOPPED';
      setBotState('STOPPED');
      setIsRunning(false);
      setIsPaused(false);
      setTradingStep('idle');
      console.log('[BOT] State: STOPPED');
      
      // Reset after stopped
      window.setTimeout(() => {
        botStateRef.current = 'IDLE';
        setBotState('IDLE');
        stopRequestedRef.current = false;
      }, 100);
    }, 50);
  }, [clearAllPendingTimers]);

  // Parse horizontal sequence
  const parseSequence = useCallback((seqStr: string) => {
    const parts = seqStr.split(',').map(p => p.trim().toUpperCase());
    return parts.map(p => {
      const dir = p.startsWith('O') ? 0 : 1;
      const barrier = parseInt(p.slice(1)) || 5;
      return { dir, barrier };
    }).filter(p => !isNaN(p.barrier));
  }, []);

  // Get next direction based on strategy
  const getNextDirection = useCallback(() => {
    const sett = settingsRef.current;
    const sess = sessionRef.current;

    if (sett.strategy === 'manual') {
      return { 
        dir: ['over', 'even', 'matches', 'rise'].includes(sett.direction) ? 0 : 1, 
        barrier: sett.barrier 
      };
    }

    if (sett.strategy === 'horizontal' && sett.category === 'over_under') {
      const sequence = parseSequence(sett.predictionSequence);
      if (sequence.length === 0) return { dir: 0, barrier: 5 };
      const current = sequence[sess.horizontal.currentIndex % sequence.length];
      return { dir: current.dir, barrier: current.barrier };
    }

    if (sett.strategy === 'alternate' && sett.category === 'even_odd') {
      return { dir: sess.alternate.nextDirection, barrier: sett.barrier };
    }

    return { dir: 0, barrier: sett.barrier };
  }, [parseSequence]);

  // CORE TRADE PLACEMENT - with state machine checks
  const placeTrade = useCallback(() => {
    // CRITICAL: Multiple safety checks
    if (stopRequestedRef.current) {
      console.log('[BOT] Trade blocked: STOP requested');
      return;
    }
    
    if (botStateRef.current !== 'RUNNING') {
      console.log('[BOT] Trade blocked: State is', botStateRef.current);
      return;
    }
    
    if (orderInFlightRef.current) {
      console.log('[BOT] Trade blocked: Order in flight');
      return;
    }
    
    if (isPausedRef.current) {
      console.log('[BOT] Trade blocked: Paused');
      return;
    }
    
    if (!isAuthorizedRef.current) {
      console.log('[BOT] Trade blocked: Not authorized');
      return;
    }

    const currentSettings = settingsRef.current;
    const currentSession = sessionRef.current;

    if (balanceRef.current < currentSession.currentStake) {
      console.error('[BOT] Insufficient balance');
      hardStop();
      return;
    }

    // Set order lock
    orderInFlightRef.current = true;
    lastTradeTimeRef.current = performance.now();
    setTradingStep('proposing');
    console.log('[BOT] Placing trade at', new Date().toISOString());

    const prediction = getNextDirection();
    
    let contractType: string;
    let barrierValue = prediction.barrier;

    switch (currentSettings.category) {
      case 'rise_fall':
        contractType = prediction.dir === 0 ? 'CALL' : 'PUT';
        break;
      case 'matches_differs':
        contractType = prediction.dir === 0 ? 'DIGITMATCH' : 'DIGITDIFF';
        barrierValue = currentSettings.barrier;
        break;
      case 'over_under':
        contractType = prediction.dir === 0 ? 'DIGITOVER' : 'DIGITUNDER';
        break;
      case 'even_odd':
        contractType = prediction.dir === 0 ? 'DIGITEVEN' : 'DIGITODD';
        break;
      default:
        contractType = 'DIGITEVEN';
    }

    const proposal: Record<string, unknown> = {
      proposal: 1,
      amount: currentSession.currentStake,
      basis: 'stake',
      contract_type: contractType,
      currency: 'USD',
      duration: currentSettings.ticks,
      duration_unit: 't',
      symbol: currentSettings.symbol,
    };

    if (['over_under', 'matches_differs'].includes(currentSettings.category)) {
      proposal.barrier = barrierValue.toString();
    }

    send(proposal);
  }, [send, hardStop, getNextDirection]);

  const placeTradeRef = useRef(placeTrade);
  useEffect(() => { placeTradeRef.current = placeTrade; }, [placeTrade]);

  // Schedule next trade with speed control - non-blocking
  const scheduleNextTrade = useCallback(() => {
    if (stopRequestedRef.current || botStateRef.current !== 'RUNNING') {
      console.log('[BOT] Next trade not scheduled: stopping');
      return;
    }

    // If trade on each tick is enabled, don't schedule - wait for tick
    if (tradeOnEachTickRef.current) {
      console.log('[BOT] Waiting for next tick to trade');
      return;
    }

    const delay = executionSpeedRef.current;
    console.log('[BOT] Scheduling next trade in', delay, 'ms');
    
    if (delay === 0) {
      // Use requestAnimationFrame for smoother non-blocking execution
      requestAnimationFrame(() => {
        if (!stopRequestedRef.current && botStateRef.current === 'RUNNING') {
          placeTradeRef.current();
        }
      });
    } else {
      safeSetTimeout(() => placeTradeRef.current(), delay);
    }
  }, [safeSetTimeout]);

  const scheduleNextTradeRef = useRef(scheduleNextTrade);
  useEffect(() => { scheduleNextTradeRef.current = scheduleNextTrade; }, [scheduleNextTrade]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    // Ignore late responses if stopping/stopped
    if (botStateRef.current === 'STOPPING' || botStateRef.current === 'STOPPED') {
      if (data.msg_type === 'proposal' || data.msg_type === 'buy') {
        console.log('[BOT] Ignoring late response:', data.msg_type);
        return;
      }
    }

    if (data.error) {
      console.error('[BOT] API Error:', data.error);
      orderInFlightRef.current = false;
      
      if (botStateRef.current === 'RUNNING' && !stopRequestedRef.current) {
        scheduleNextTradeRef.current();
      }
      return;
    }

    switch (data.msg_type) {
      case 'authorize':
        setIsAuthorized(true);
        setAccountId((data.authorize as Record<string, string>)?.loginid || '');
        send({ balance: 1, subscribe: 1 });
        break;

      case 'balance':
        const newBalance = (data.balance as Record<string, number>)?.balance || 0;
        setBalance(newBalance);
        config.onBalanceUpdate?.(newBalance);
        break;

      case 'tick':
        // Handle tick for "trade on each tick" mode
        if (tradeOnEachTickRef.current && 
            botStateRef.current === 'RUNNING' && 
            !stopRequestedRef.current && 
            !orderInFlightRef.current &&
            !isPausedRef.current) {
          console.log('[BOT] Tick received, placing trade');
          placeTradeRef.current();
        }
        break;

      case 'proposal':
        // Check state before purchasing
        if (botStateRef.current !== 'RUNNING' || stopRequestedRef.current) {
          console.log('[BOT] Proposal ignored: not running or stopping');
          orderInFlightRef.current = false;
          return;
        }
        
        const proposal = data.proposal as Record<string, unknown>;
        currentProposalRef.current = proposal?.id as string;
        send({ buy: proposal?.id, price: proposal?.ask_price });
        setTradingStep('settling');
        break;

      case 'buy':
        const buyData = data.buy as Record<string, unknown>;
        currentContractRef.current = buyData?.contract_id as string;
        send({ 
          proposal_open_contract: 1, 
          contract_id: buyData?.contract_id,
          subscribe: 1 
        });
        break;

      case 'proposal_open_contract':
        const poc = data.proposal_open_contract as Record<string, unknown>;
        
        if (!currentTradeRef.current) {
          currentTradeRef.current = {
            id: Date.now(),
            type: poc?.contract_type as string,
            stake: poc?.buy_price as number,
            entry: String(poc?.entry_tick || '—'),
            exit: '—',
            profit: 0,
            status: 'Open',
            timestamp: new Date(),
          };
        } else {
          currentTradeRef.current.entry = String(poc?.entry_tick || currentTradeRef.current.entry);
          currentTradeRef.current.exit = String(poc?.exit_tick || currentTradeRef.current.exit);
          currentTradeRef.current.profit = (poc?.profit as number) || currentTradeRef.current.profit;
        }

        if (poc?.is_sold || poc?.status === 'sold') {
          // Release order lock
          orderInFlightRef.current = false;
          
          const profit = currentTradeRef.current.profit || 0;
          const isWin = profit > 0;
          
          const completedTrade: Trade = {
            ...currentTradeRef.current as Trade,
            status: isWin ? 'Won' : 'Lost',
          };
          
          setTrades(prev => [...prev, completedTrade]);
          config.onTradeComplete?.(completedTrade);
          config.onSoundPlay?.(isWin ? 'win' : 'loss');

          const executionTime = performance.now() - lastTradeTimeRef.current;
          console.log('[BOT] Trade completed in', executionTime.toFixed(2), 'ms. Result:', isWin ? 'WIN' : 'LOSS');

          const currentSettings = settingsRef.current;
          
          setSession(prev => {
            const newSession = { ...prev };
            newSession.sessionPnL += profit;
            
            if (isWin) {
              newSession.consecutiveLosses = 0;
              newSession.currentStake = currentSettings.stake;
              
              if (currentSettings.strategy === 'horizontal') {
                newSession.horizontal.currentIndex++;
              }
            } else {
              newSession.consecutiveLosses++;
              newSession.totalLosses++;
              newSession.currentStake *= currentSettings.martingale;
            }
            
            if (currentSettings.strategy === 'alternate') {
              newSession.alternate.nextDirection = newSession.alternate.nextDirection === 0 ? 1 : 0;
            }
            
            return newSession;
          });

          setTradingStep('ready');
          setLastTradeResult(isWin ? 'win' : 'loss');
          
          currentTradeRef.current = null;
          currentContractRef.current = null;
          
          // Check stop conditions BEFORE scheduling next trade
          const sess = sessionRef.current;
          const sett = settingsRef.current;
          let shouldStop = false;
          let stopReason = '';
          
          if (sett.takeProfit > 0 && sess.sessionPnL + profit >= sett.takeProfit) {
            shouldStop = true;
            stopReason = 'Take profit reached';
          }
          if (sett.stopLoss > 0 && sess.sessionPnL + profit <= -sett.stopLoss) {
            shouldStop = true;
            stopReason = 'Stop loss reached';
          }
          if (sett.maxConsecutiveLosses > 0 && !isWin && sess.consecutiveLosses + 1 >= sett.maxConsecutiveLosses) {
            shouldStop = true;
            stopReason = 'Max consecutive losses reached';
          }
          if (sett.maxTotalLosses > 0 && !isWin && sess.totalLosses + 1 >= sett.maxTotalLosses) {
            shouldStop = true;
            stopReason = 'Max total losses reached';
          }
          
          if (shouldStop) {
            console.log('[BOT] Auto-stop:', stopReason);
            hardStop();
            return;
          }

          // Update balance
          send({ balance: 1 });
          
          // Schedule next trade if still running
          if (botStateRef.current === 'RUNNING' && !stopRequestedRef.current) {
            scheduleNextTradeRef.current();
          }
        }
        break;
    }
  }, [send, config, hardStop]);

  const connect = useCallback((token: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    wsRef.current = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    wsRef.current.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      send({ authorize: token });
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (e) {
        console.error('[BOT] Parse error:', e);
      }
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      setIsAuthorized(false);
    };

    wsRef.current.onerror = () => {
      setIsConnecting(false);
    };
  }, [send, handleMessage]);

  const disconnect = useCallback(() => {
    hardStop();
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
    setIsAuthorized(false);
  }, [hardStop]);

  const startBot = useCallback(() => {
    if (!isAuthorized) return;
    if (botStateRef.current !== 'IDLE') {
      console.log('[BOT] Cannot start: state is', botStateRef.current);
      return;
    }

    console.log('[BOT] Starting...');
    stopRequestedRef.current = false;
    orderInFlightRef.current = false;
    botStateRef.current = 'RUNNING';
    setBotState('RUNNING');
    setIsRunning(true);
    setIsPaused(false);
    setTradingStep('idle');
    
    // Subscribe to ticks if trade on each tick is enabled
    if (tradeOnEachTickRef.current) {
      console.log('[BOT] Trade on each tick mode - subscribing to ticks');
      send({ ticks: settingsRef.current.symbol, subscribe: 1 });
    }
    
    // IMMEDIATE first trade - no delay on START
    console.log('[BOT] First trade: IMMEDIATE');
    requestAnimationFrame(() => {
      if (botStateRef.current === 'RUNNING') {
        placeTradeRef.current();
      }
    });
  }, [isAuthorized, send]);

  const stopBot = useCallback(() => {
    console.log('[BOT] Stop requested by user');
    hardStop();
  }, [hardStop]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const newPaused = !prev;
      console.log('[BOT] Pause toggled:', newPaused);
      if (!newPaused && botStateRef.current === 'RUNNING') {
        scheduleNextTradeRef.current();
      }
      return newPaused;
    });
  }, []);

  const clearTrades = useCallback(() => {
    setTrades([]);
    setSession(prev => ({
      ...prev,
      sessionPnL: 0,
      consecutiveLosses: 0,
      totalLosses: 0,
      currentStake: settings.stake,
      horizontal: { sequence: [], currentIndex: 0 },
      alternate: { nextDirection: 0 },
    }));
  }, [settings.stake]);

  const updateSettings = useCallback((newSettings: Partial<BotSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.category) {
        switch (newSettings.category) {
          case 'rise_fall':
            updated.direction = 'rise';
            if (updated.ticks < 5) updated.ticks = 5;
            break;
          case 'matches_differs':
            updated.direction = 'matches';
            if (updated.ticks > 5) updated.ticks = 1;
            break;
          case 'over_under':
            updated.direction = 'over';
            if (updated.ticks > 5) updated.ticks = 1;
            break;
          case 'even_odd':
            updated.direction = 'even';
            if (updated.ticks > 5) updated.ticks = 1;
            break;
        }
      }
      return updated;
    });
  }, []);

  const updateExecutionSpeed = useCallback((speed: number) => {
    const clampedSpeed = Math.max(0, Math.min(50, speed));
    setExecutionSpeed(clampedSpeed);
    console.log('[BOT] Execution speed set to', clampedSpeed, 'ms');
  }, []);

  const updateTradeOnEachTick = useCallback((enabled: boolean) => {
    setTradeOnEachTick(enabled);
    console.log('[BOT] Trade on each tick:', enabled);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hardStop();
      wsRef.current?.close();
    };
  }, [hardStop]);

  return {
    isConnected,
    isConnecting,
    isAuthorized,
    balance,
    accountId,
    isRunning,
    isPaused,
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
  };
}
