import { useState, useCallback, useRef, useEffect } from 'react';
import { Trade, TradingSession, BotSettings, DIRECTION_OPTIONS } from '@/types/trading';
import { showTakeProfitNotification, showLossNotification } from '@/components/trading/TradingNotifications';

interface UseTradingBotConfig {
  onTradeComplete?: (trade: Trade) => void;
  onBalanceUpdate?: (balance: number) => void;
  onSoundPlay?: (type: 'win' | 'loss') => void;
  onTick?: (current: number, total: number) => void;
}

// State machine states
type BotState = 'IDLE' | 'RUNNING' | 'STOPPING' | 'STOPPED';
type TradingStep = 'idle' | 'buying' | 'settling' | 'ready';

export function useTradingBot(config: UseTradingBotConfig = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reqIdRef = useRef(1);
  const currentProposalRef = useRef<string | null>(null);
  const currentContractRef = useRef<string | null>(null);
  const currentTradeRef = useRef<Partial<Trade> | null>(null);
  const currentContractTypeRef = useRef<string>('');

  // STATE MACHINE - Critical for preventing unwanted trades
  const botStateRef = useRef<BotState>('IDLE');
  const orderInFlightRef = useRef(false); // Lock for preventing concurrent orders
  const stopRequestedRef = useRef(false); // Hard kill switch
  const lastTradeTimeRef = useRef(0); // High-resolution timing
  const tradeTimeoutIdRef = useRef<number | null>(null); // Safety timeout for frozen trades

  // Pending callbacks/timers to clear on stop
  const pendingTimersRef = useRef<Set<number>>(new Set());

  // WebSocket reconnection
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelayRef = useRef(300);
  const authTokenRef = useRef<string>('');
  const appIdRef = useRef<string>('');
  const accountIdRef = useRef<string>('');
  const currencyRef = useRef<string>('');
  const keepAliveRef = useRef<number | null>(null);
  const consecutiveErrorsRef = useRef(0); // Prevents a tight error-retry loop from freezing the page

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [balance, setBalance] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const tradesRef = useRef<Trade[]>([]);
  const [tradingStep, setTradingStep] = useState<TradingStep>('idle');
  const [lastTradeResult, setLastTradeResult] = useState<'win' | 'loss' | null>(null);
  const [executionSpeed, setExecutionSpeed] = useState(0); // 0-50ms speed control
  const [botState, setBotState] = useState<BotState>('IDLE');

  const [session, setSession] = useState<TradingSession>({
    sessionPnL: 0,
    consecutiveLosses: 0,
    totalLosses: 0,
    currentStake: 0,
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
    ticks: 0,
    stake: 0,
    martingale: 0,
    takeProfit: 0,
    stopLoss: 0,
    maxConsecutiveLosses: 0,
    maxTotalLosses: 0,
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
  useEffect(() => { tradesRef.current = trades; }, [trades]);

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

  // Safe clear
  const clearSafeTimeout = useCallback((id: number) => {
    window.clearTimeout(id);
    pendingTimersRef.current.delete(id);
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
    if (tradeTimeoutIdRef.current) {
      clearSafeTimeout(tradeTimeoutIdRef.current);
      tradeTimeoutIdRef.current = null;
    }

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

    // Ensure stake is valid (use 0.35 as minimum if not set).
    // Round to 2 decimals - Deriv rejects amounts with 3+ decimals (e.g. a
    // fractional martingale like 1.5 produces 1.125 which is an invalid stake).
    const stakeToUse = Math.round(((currentSession.currentStake || currentSettings.stake || 0.35)) * 100) / 100;

    if (balanceRef.current < stakeToUse) {
      console.error('[BOT] Insufficient balance');
      hardStop();
      return;
    }

    // Set order lock
    orderInFlightRef.current = true;
    lastTradeTimeRef.current = performance.now();
    setTradingStep('buying'); // STEP 1: BUYING
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

    // Store current contract type so the trade log can show the exact type immediately
    currentContractTypeRef.current = contractType;

    const proposal: Record<string, unknown> = {
      proposal: 1,
      amount: stakeToUse,
      basis: 'stake',
      contract_type: contractType,
      currency: currencyRef.current || 'USD',
      duration: currentSettings.ticks || 1,
      duration_unit: 't',
      underlying_symbol: currentSettings.symbol,
    };

    if (['over_under', 'matches_differs'].includes(currentSettings.category)) {
      proposal.barrier = barrierValue.toString();
    }

    // Store contract type for use when creating trade entry
    currentContractTypeRef.current = contractType;

    // Start heartbeat timeout (20s)
    if (tradeTimeoutIdRef.current) clearSafeTimeout(tradeTimeoutIdRef.current);
    console.log('[BOT] Starting heartbeat');
    tradeTimeoutIdRef.current = safeSetTimeout(() => {
      console.log('[BOT] Trade timeout (Heartbeat lost) - resetting state');
      orderInFlightRef.current = false;
      tradeTimeoutIdRef.current = null;

      if (botStateRef.current === 'RUNNING' && !stopRequestedRef.current) {
        scheduleNextTradeRef.current();
      }
    }, 20000);

    if (!send(proposal)) {
      console.error('[BOT] Failed to send proposal - connection lost');
      orderInFlightRef.current = false;
      if (tradeTimeoutIdRef.current) {
        clearSafeTimeout(tradeTimeoutIdRef.current);
        tradeTimeoutIdRef.current = null;
      }
      return;
    }
  }, [send, hardStop, getNextDirection, safeSetTimeout, clearSafeTimeout]);

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
    // After an error, force a short breather so a rejecting server can't
    // trigger a hot loop (each attempt is a real WS round-trip).
    const effectiveDelay = consecutiveErrorsRef.current > 0 ? Math.max(delay, 1000) : delay;
    console.log('[BOT] Scheduling next trade in', effectiveDelay, 'ms');

    if (effectiveDelay === 0) {
      // Direct execution for 0ms delay to satisfy "No batching" and "process logic immediately"
      // Check state again just in case
      if (!stopRequestedRef.current && botStateRef.current === 'RUNNING') {
        placeTradeRef.current();
      }
    } else {
      safeSetTimeout(() => placeTradeRef.current(), effectiveDelay);
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

      // Rapid-error guard: if the server keeps rejecting instantly, the delay-0
      // retry loop would spin thousands of times and freeze the page.
      consecutiveErrorsRef.current++;
      if (consecutiveErrorsRef.current >= 5) {
        console.error('[BOT] Too many consecutive errors - stopping bot to prevent a crash loop');
        hardStop();
        return;
      }

      if (botStateRef.current === 'RUNNING' && !stopRequestedRef.current) {
        scheduleNextTradeRef.current();
      }
      return;
    }

    // Refresh heartbeat on ANY trade-related message
    if (['proposal', 'buy', 'proposal_open_contract'].includes(data.msg_type as string) && orderInFlightRef.current) {
      if (tradeTimeoutIdRef.current) clearSafeTimeout(tradeTimeoutIdRef.current);

      // Restart timeout (Refresh Heartbeat)
      tradeTimeoutIdRef.current = safeSetTimeout(() => {
        console.log('[BOT] Trade timeout (Stalled) - resetting state');
        orderInFlightRef.current = false;
        tradeTimeoutIdRef.current = null;
        if (botStateRef.current === 'RUNNING' && !stopRequestedRef.current) {
          scheduleNextTradeRef.current();
        }
      }, 20000);
    }

    switch (data.msg_type) {
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
        // NOTE: We do NOT advance state here. State advances to SETTLING only on 'buy' success.
        // We stay in 'buying' (conceptually) until the contract is bought.

        // Reset tick progress on new trade start - IMMEDIATE update
        config.onTick?.(0, settingsRef.current.ticks || 1);

        // Create trade entry immediately for real-time display with actual contract type
        if (!currentTradeRef.current) {
          const currentSettings = settingsRef.current;
          const currentSession = sessionRef.current;
          currentTradeRef.current = {
            id: Date.now(),
            type: currentContractTypeRef.current || 'Unknown',
            stake: currentSession.currentStake || currentSettings.stake || 0.35,
            entry: '—',
            exit: '—',
            profit: 0,
            status: 'Open',
            timestamp: new Date(),
          };
          // Add to trades immediately for real-time display
          setTrades(prev => {
            const existing = prev.find(t => t.id === currentTradeRef.current?.id);
            if (!existing && currentTradeRef.current) {
              return [...prev, currentTradeRef.current as Trade];
            }
            return prev;
          });
        }
        break;

      case 'buy':
        consecutiveErrorsRef.current = 0; // A successful buy breaks the error streak
        const buyData = data.buy as Record<string, unknown>;
        currentContractRef.current = buyData?.contract_id as string;
        // Stop any previous contract stream FIRST so stale messages from a
        // settled contract can never trigger duplicate settlements.
        send({ forget_all: 'proposal_open_contract' });
        send({
          proposal_open_contract: 1,
          contract_id: buyData?.contract_id,
          subscribe: 1
        });
        setTradingStep('settling'); // STEP 2: SETTLING
        break;

      case 'proposal_open_contract':
        // CRITICAL: Only process stream messages while a trade is actually in
        // flight. After settlement orderInFlight is released, so any lingering
        // message from the (still-subscribed) old contract is ignored - this
        // prevents duplicate settlements, phantom trades and trade spam.
        if (!orderInFlightRef.current) {
          return;
        }

        const poc = data.proposal_open_contract as Record<string, unknown>;

        // Second layer: if we have an active contract, only accept its own
        // stream messages (a lingering message from the previous contract
        // arriving during this trade's flight must be ignored).
        const streamContractId = poc?.contract_id != null ? String(poc.contract_id) : '';
        if (currentContractRef.current && streamContractId && streamContractId !== String(currentContractRef.current)) {
          return;
        }

        // Update Tick Progress - IMMEDIATE sync
        // Use tick_stream length if available, otherwise fallback
        const tickStream = poc?.tick_stream as Array<unknown>;
        const currentTick = tickStream ? tickStream.length : (poc?.tick_passed as number || 0);
        const totalTicks = (poc?.tick_count as number) || settingsRef.current.ticks || 1;

        // Update tick progress immediately
        config.onTick?.(currentTick, totalTicks);

        // Update trade entry immediately for real-time sync
        const stream = (poc?.tick_stream as Array<Record<string, unknown>>) || [];
        const firstTick = stream[0];
        const lastTick = stream[stream.length - 1];

        if (!currentTradeRef.current) {
          currentTradeRef.current = {
            id: Date.now(),
            type: poc?.contract_type as string,
            stake: parseFloat(String(poc?.buy_price)) || 0,
            entry: String(poc?.entry_tick ?? firstTick?.tick ?? '—'),
            exit: String(poc?.exit_tick ?? lastTick?.tick ?? '—'),
            profit: 0,
            status: 'Open',
            timestamp: new Date(),
          };
          // Add to trades immediately for real-time display
          setTrades(prev => {
            const existing = prev.find(t => t.id === currentTradeRef.current?.id);
            if (!existing && currentTradeRef.current) {
              return [...prev, currentTradeRef.current as Trade];
            }
            return prev;
          });
        } else {
          // Update existing trade immediately - only re-render when values change
          const nextEntry = String(poc?.entry_tick ?? firstTick?.tick ?? currentTradeRef.current.entry);
          const nextExit = String(poc?.exit_tick ?? lastTick?.tick ?? currentTradeRef.current.exit);
          const nextProfit = parseFloat(String(poc?.profit)) || currentTradeRef.current.profit;

          if (nextEntry !== currentTradeRef.current.entry ||
              nextExit !== currentTradeRef.current.exit ||
              nextProfit !== currentTradeRef.current.profit) {
            currentTradeRef.current.entry = nextEntry;
            currentTradeRef.current.exit = nextExit;
            currentTradeRef.current.profit = nextProfit;

            // Update trade in list immediately for real-time sync
            setTrades(prev => prev.map(t =>
              t.id === currentTradeRef.current?.id
                ? { ...t, ...currentTradeRef.current } as Trade
                : t
            ));
          }
        }

        if (poc?.is_sold || poc?.status === 'sold') {
          // STEP 3: READY (Contract Settled)

          // Clear heartbeat timeout permanently for this trade
          if (tradeTimeoutIdRef.current) {
            clearSafeTimeout(tradeTimeoutIdRef.current);
            tradeTimeoutIdRef.current = null;
          }

          // Release order lock
          orderInFlightRef.current = false;

          const currentSettings = settingsRef.current;
          const profit = currentTradeRef.current.profit || 0;
          const isWin = profit > 0;

          // Calculate new session state based on flowchart logic
          const updatedSession = { ...sessionRef.current };
          updatedSession.sessionPnL += profit;

          // MARTINGALE + HORIZONTAL SEQUENCE LOGIC
          if (isWin) {
            // WIN: Reset to initial stake for next trade
            updatedSession.consecutiveLosses = 0;
            updatedSession.currentStake = Math.round(((currentSettings.stake || 0.35)) * 100) / 100; // Reset to initial stake

            // Horizontal strategy behaviour:
            // Example: O3,U7
            //  - Start: O3
            //  - After LOSS on O3 -> move to U7 (index 1)
            //  - After WIN on U7  -> reset back to O3 (index 0)
            if (currentSettings.strategy === 'horizontal') {
              // Always resume from the FIRST prediction after a successful recovery
              updatedSession.horizontal.currentIndex = 0;
            }
          } else {
            // LOSS: Multiply stake by the configured multiplier for next trade.
            // 0 (empty input) = NO martingale, stake stays the same.
            // Round to 2 decimals so fractional martingales (e.g. 1.5 -> 1.125)
            // never produce an invalid stake amount that Deriv rejects.
            updatedSession.consecutiveLosses++;
            updatedSession.totalLosses++;
            const multiplier = currentSettings.martingale && currentSettings.martingale > 0 ? currentSettings.martingale : 1;
            updatedSession.currentStake = Math.round(updatedSession.currentStake * multiplier * 100) / 100;

            // Horizontal strategy: move to next prediction as recovery step
            // For O3,U7 this means: O3 (loss) -> U7 (recovery)
            if (currentSettings.strategy === 'horizontal') {
              updatedSession.horizontal.currentIndex++;
            }
          }

          if (currentSettings.strategy === 'alternate') {
            updatedSession.alternate.nextDirection = updatedSession.alternate.nextDirection === 0 ? 1 : 0;
          }

          // Check stop conditions BEFORE updating state/session
          let shouldStop = false;
          let stopReason = '';

          if (currentSettings.takeProfit > 0 && updatedSession.sessionPnL >= currentSettings.takeProfit) {
            shouldStop = true;
            stopReason = 'Take profit reached';
            // Calculate stats for enhanced notification
            // Enhanced notification without stats
            showTakeProfitNotification(updatedSession.sessionPnL, currentSettings.takeProfit);
          }
          if (currentSettings.stopLoss > 0 && updatedSession.sessionPnL <= -currentSettings.stopLoss) {
            shouldStop = true;
            stopReason = 'Stop loss reached';
            showLossNotification('stop_loss', Math.abs(updatedSession.sessionPnL));
          }
          if (currentSettings.maxConsecutiveLosses > 0 && !isWin && updatedSession.consecutiveLosses >= currentSettings.maxConsecutiveLosses) {
            shouldStop = true;
            stopReason = 'Max consecutive losses reached';
            showLossNotification('consecutive_losses', updatedSession.consecutiveLosses);
          }
          if (currentSettings.maxTotalLosses > 0 && !isWin && updatedSession.totalLosses >= currentSettings.maxTotalLosses) {
            shouldStop = true;
            stopReason = 'Max total losses reached';
            showLossNotification('total_losses', updatedSession.totalLosses);
          }

          // Update tick progress to 100% immediately
          config.onTick?.(totalTicks, totalTicks);

          const completedTrade: Trade = {
            ...currentTradeRef.current as Trade,
            status: isWin ? 'Won' : 'Lost',
          };

          // Log for debugging
          const executionTime = performance.now() - lastTradeTimeRef.current;
          console.log('[BOT] Contract sold —', executionTime.toFixed(2), 'ms. Result:', isWin ? 'WIN' : 'LOSS', '| Stake used:', currentTradeRef.current.stake, '| Next Stake:', updatedSession.currentStake);

          // UPDATE IMMEDIATELY - no delays for instant sync
          // 1. UPDATE TRADE LOG immediately (replace existing if present, otherwise add)
          setTrades(prev => {
            const filtered = prev.filter(t => t.id !== completedTrade.id);
            return [...filtered, completedTrade];
          });
          config.onTradeComplete?.(completedTrade);
          config.onSoundPlay?.(isWin ? 'win' : 'loss');

          // 2. UPDATE SESSION with calculated state immediately
          // CRITICAL: Update ref IMMEDIATELY so next trade uses correct stake
          sessionRef.current = updatedSession;
          setSession(updatedSession);
          setTradingStep('ready'); // Visual update
          setLastTradeResult(isWin ? 'win' : 'loss');

          currentTradeRef.current = null;
          currentContractRef.current = null;

          if (shouldStop) {
            console.log('[BOT] Auto-stop:', stopReason);
            hardStop();
            return;
          }

          // Update balance
          send({ balance: 1 });

          // Schedule next trade if still running - IMMEDIATE if speed is 0
          if (botStateRef.current === 'RUNNING' && !stopRequestedRef.current) {
            scheduleNextTradeRef.current();
          }
        }
        break;
    }
  }, [send, config, hardStop]);

  // Auto-reconnect function
  const attemptReconnect = useCallback(() => {
    if (!authTokenRef.current || reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('[BOT] Max reconnect attempts reached or no token');
      reconnectAttemptsRef.current = 0;
      reconnectDelayRef.current = 300;
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`[BOT] Reconnecting attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}...`);

    reconnectTimeoutRef.current = window.setTimeout(() => {
      if (authTokenRef.current && appIdRef.current) {
        connect(authTokenRef.current, appIdRef.current);
      }
    }, reconnectDelayRef.current);

    // Exponential backoff
    reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 4000);
  }, []);

  const connect = useCallback(async (token: string, appId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Store credentials for reconnection
    authTokenRef.current = token;
    appIdRef.current = appId;
    reconnectAttemptsRef.current = 0;
    reconnectDelayRef.current = 300;

    setIsConnecting(true);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Deriv-App-ID': appId,
    };

    try {
      // 1. Fetch trading accounts to determine account id + currency
      const accountsRes = await fetch(
        'https://api.derivws.com/trading/v1/options/accounts',
        { method: 'GET', headers }
      );
      if (!accountsRes.ok) {
        console.error('[BOT] Accounts request failed:', accountsRes.status, await accountsRes.text());
        throw new Error(`Accounts request failed (${accountsRes.status})`);
      }
      const accountsData = await accountsRes.json();
      const accounts: Array<Record<string, unknown>> = accountsData?.data || [];
      const account =
        accounts.find((a) => a.account_type === 'demo' && a.status === 'active') ||
        accounts.find((a) => a.status === 'active') ||
        accounts[0];
      if (!account) throw new Error('No trading accounts found for this token');
      accountIdRef.current = account.account_id as string;
      currencyRef.current = (account.currency as string) || 'USD';
      setAccountId(accountIdRef.current);
      setBalance(typeof account.balance === 'number' ? account.balance : 0);

      // 2. Request a short-lived authenticated WebSocket URL (OTP, 120s)
      const otpRes = await fetch(
        `https://api.derivws.com/trading/v1/options/accounts/${accountIdRef.current}/otp`,
        { method: 'POST', headers }
      );
      if (!otpRes.ok) {
        console.error('[BOT] OTP request failed:', otpRes.status, await otpRes.text());
        throw new Error(`OTP request failed (${otpRes.status})`);
      }
      const otpData = await otpRes.json();
      const wsUrl = otpData?.data?.url as string;
      if (!wsUrl) throw new Error('OTP response missing websocket URL');

      // 3. Connect to the authenticated websocket
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setIsAuthorized(true);
        reconnectAttemptsRef.current = 0;
        reconnectDelayRef.current = 300;
        consecutiveErrorsRef.current = 0;

        // Keep the connection alive - Deriv drops idle connections without a periodic ping
        if (keepAliveRef.current) {
          clearInterval(keepAliveRef.current);
        }
        keepAliveRef.current = window.setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
              wsRef.current.send(JSON.stringify({ ping: 1 }));
            } catch (e) {
              console.error('[BOT] Keepalive ping failed:', e);
            }
          }
        }, 30000);

        send({ balance: 1, subscribe: 1 });

        // AUTO-RESUME: If we reconnected while running, kickstart the loop again
        if (botStateRef.current === 'RUNNING' && !stopRequestedRef.current &&
          !orderInFlightRef.current && !isPausedRef.current) {
          console.log('[BOT] Reconnected - resuming trade loop');
          scheduleNextTradeRef.current();
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (e) {
          console.error('[BOT] Parse error:', e);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        setIsAuthorized(false);

        // Stop keepalive - connection is gone
        if (keepAliveRef.current) {
          clearInterval(keepAliveRef.current);
          keepAliveRef.current = null;
        }

        // CRITICAL: If we were in the middle of a trade, it's failed now.
        // Reset immediately so we don't have to wait for the 20s timeout.
        if (orderInFlightRef.current) {
          console.log('[BOT] Disconnect detected while trade in flight - resetting order lock');
          orderInFlightRef.current = false;
          if (tradeTimeoutIdRef.current) {
            clearSafeTimeout(tradeTimeoutIdRef.current);
            tradeTimeoutIdRef.current = null;
          }
          // Optionally set error status or just ready to retry
          setTradingStep('idle');
        }

        // Auto-reconnect if was authorized and not a clean close
        if (authTokenRef.current && event.code !== 1000 && isAuthorizedRef.current) {
          console.log('[BOT] Connection closed unexpectedly, attempting reconnect...');
          attemptReconnect();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[BOT] WebSocket error:', error);
        setIsConnecting(false);
      };
    } catch (error) {
      console.error('[BOT] Connection failed:', error);
      setIsConnecting(false);
      setIsConnected(false);
      setIsAuthorized(false);
    }
  }, [send, handleMessage, attemptReconnect]);

  const disconnect = useCallback(() => {
    hardStop();

    // Clear reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    authTokenRef.current = '';
    appIdRef.current = '';
    accountIdRef.current = '';
    currencyRef.current = '';
    reconnectAttemptsRef.current = 0;

    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }

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
    consecutiveErrorsRef.current = 0;
    botStateRef.current = 'RUNNING';
    setBotState('RUNNING');
    setIsRunning(true);
    setIsPaused(false);
    setTradingStep('idle');

    // Initialize session with correct starting stake from settings
    const initialStake = Math.round(((settingsRef.current.stake || 0.35)) * 100) / 100;
    setSession(prev => ({
      ...prev,
      currentStake: initialStake,
      sessionPnL: 0,
      consecutiveLosses: 0,
      totalLosses: 0,
    }));
    sessionRef.current.currentStake = initialStake;

    // Subscribe to ticks if trade on each tick is enabled
    if (tradeOnEachTickRef.current) {
      console.log('[BOT] Trade on each tick mode - subscribing to ticks');
      send({ ticks: settingsRef.current.symbol, subscribe: 1 });
    }

    // IMMEDIATE first trade - execute synchronously on next tick
    console.log('[BOT] First trade: IMMEDIATE');
    // Use requestAnimationFrame for immediate execution without blocking
    requestAnimationFrame(() => {
      if (botStateRef.current === 'RUNNING' && !stopRequestedRef.current) {
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
      isPausedRef.current = newPaused;

      // If resuming and not currently in a trade, schedule next trade immediately
      if (!newPaused && botStateRef.current === 'RUNNING' && !orderInFlightRef.current) {
        console.log('[BOT] Resuming - scheduling next trade');
        // Use setTimeout to ensure ref is updated first
        setTimeout(() => scheduleNextTradeRef.current(), 0);
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
      currentStake: Math.round(((settings.stake || 0.35)) * 100) / 100,
      horizontal: { sequence: [], currentIndex: 0 },
      alternate: { nextDirection: 0 },
    }));
  }, [settings.stake]);

  const updateSettings = useCallback((newSettings: Partial<BotSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };

      // Update logic for specific categories
      if (newSettings.category) {
        // Reset direction to a valid option for the newly selected contract
        const dirOptions = DIRECTION_OPTIONS[newSettings.category] || [];
        if (dirOptions.length > 0 && !dirOptions.some(o => o.value === updated.direction)) {
          updated.direction = dirOptions[0].value;
        }

        switch (newSettings.category) {
          case 'matches_differs':
          case 'over_under':
          case 'even_odd':
            if (updated.ticks > 5) updated.ticks = 1;
            break;
        }
      }

      // CRITICAL: Update Ref IMMEDIATELY to prevent stale state usage in fast loops
      settingsRef.current = updated;

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

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

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
