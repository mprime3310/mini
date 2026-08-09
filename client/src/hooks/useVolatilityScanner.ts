import { useState, useCallback, useRef, useEffect } from 'react';
import { SYMBOLS, ScannerSignal } from '@/types/trading';

// Distinct public app_ids: Deriv rate-limits per app_id (~220 requests/min
// each) rather than per IP, so splitting symbols across several connections
// multiplies the polling throughput. Subscriptions are rejected in some
// networks (spurious InvalidSymbol), leaving one-shot ticks_history as the
// only reliable way to keep prices moving.
const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=';
const SCANNER_APP_IDS = [113701, 25807, 16493, 36355, 22615, 30231];
const SCANNER_GROUP_SIZES = [3, 3, 3, 3, 3, 2];
const POLL_INTERVAL_MS = 300; // one request per connection per interval (~200/min)
const POLL_STALE_MS = 500;    // skip polling symbols recently fed by live ticks

interface UseVolatilityScannerConfig {
  threshold?: number;
  analysisType?: 'evenodd' | 'overunder';
  targetDigit?: number;
  windowSize?: number;
}

export function useVolatilityScanner(config: UseVolatilityScannerConfig = {}) {
  const { 
    threshold = 55, 
    analysisType = 'evenodd', 
    targetDigit = 5,
    windowSize = 120 
  } = config;

  const wsRefs = useRef<WebSocket[]>([]);
  const pollersRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const keepAlivesRef = useRef<Map<WebSocket, ReturnType<typeof setInterval>>>(new Map());
  const dataRef = useRef<Map<string, number[]>>(new Map());
  const previousPercentagesRef = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const symbolLastTickRef = useRef<Map<string, number>>(new Map());

  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [signals, setSignals] = useState<ScannerSignal[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const calculatePercentage = useCallback((ticks: number[], type: string, digit: number): { percentage: number; signal: string } => {
    if (ticks.length === 0) return { percentage: 0, signal: '' };

    const relevantTicks = ticks.slice(-windowSize);
    let count = 0;
    let signal = '';

    if (type === 'evenodd') {
      const evenCount = relevantTicks.filter(d => d % 2 === 0).length;
      const evenPercentage = (evenCount / relevantTicks.length) * 100;
      const oddPercentage = 100 - evenPercentage;

      if (evenPercentage >= oddPercentage) {
        count = evenCount;
        signal = 'EVEN';
      } else {
        count = relevantTicks.length - evenCount;
        signal = 'ODD';
      }
    } else {
      const overCount = relevantTicks.filter(d => d > digit).length;
      const underCount = relevantTicks.filter(d => d < digit).length;

      if (overCount >= underCount) {
        count = overCount;
        signal = 'OVER';
      } else {
        count = underCount;
        signal = 'UNDER';
      }
    }

    return {
      percentage: (count / relevantTicks.length) * 100,
      signal,
    };
  }, [windowSize]);

  const extractLastDigit = useCallback((price: number, pipSize: number = 4): number => {
    const formatted = price.toFixed(pipSize);
    return parseInt(formatted.slice(-1));
  }, []);

  const currentAnalysisTypeRef = useRef(analysisType);
  const currentTargetDigitRef = useRef(targetDigit);
  const currentThresholdRef = useRef(threshold);

  // Keep refs in sync with props
  useEffect(() => {
    currentAnalysisTypeRef.current = analysisType;
    currentTargetDigitRef.current = targetDigit;
    currentThresholdRef.current = threshold;
    
    // Immediately recalculate signals when analysis type changes
    if (isRunning) {
      updateSignalsImmediate();
    }
  }, [analysisType, targetDigit, threshold]);

  const updateSignalsImmediate = useCallback(() => {
    const newSignals: ScannerSignal[] = [];
    const currentType = currentAnalysisTypeRef.current;
    const currentDigit = currentTargetDigitRef.current;
    const currentThreshold = currentThresholdRef.current;

    SYMBOLS.forEach(symbol => {
      const ticks = dataRef.current.get(symbol.code) || [];
      if (ticks.length < 10) return;

      const { percentage, signal } = calculatePercentage(ticks, currentType, currentDigit);
      
      if (percentage >= currentThreshold) {
        const previousPercentage = previousPercentagesRef.current.get(symbol.code) || percentage;
        const deviation = percentage - previousPercentage;
        
        previousPercentagesRef.current.set(symbol.code, percentage);

        newSignals.push({
          symbol: symbol.code,
          name: symbol.name,
          percentage,
          signal: signal as ScannerSignal['signal'],
          deviation,
          lastUpdate: new Date(),
          isOneSecond: symbol.isOneSecond || false,
        });
      }
    });

    // Sort by percentage descending
    newSignals.sort((a, b) => b.percentage - a.percentage);
    
    setSignals(newSignals);
    setActiveCount(newSignals.length);
    setLastUpdate(new Date());
  }, [calculatePercentage]);

  const updateSignals = updateSignalsImmediate;

  // One-shot ticks_history request on a specific connection. These work
  // reliably even when the live tick subscription is rejected by the server.
  const requestHistory = useCallback((ws: WebSocket, symbolCode: string) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      ticks_history: symbolCode,
      end: 'latest',
      count: 600,
      style: 'ticks',
      adjust_start_time: 1,
    }));
  }, []);

  // Per-connection round-robin poller: continuously re-fetches the latest
  // history for the connection's symbol group so prices/signals keep moving.
  // It idles for a symbol (no extra API calls) whenever live ticks are
  // flowing normally for that symbol.
  const startConnPollers = useCallback((ws: WebSocket, group: typeof SYMBOLS) => {
    if (group.length === 0) return;
    let idx = 0;
    const timer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      for (let i = 0; i < group.length; i++) {
        const symbol = group[(idx + i) % group.length];
        const lastTick = symbolLastTickRef.current.get(symbol.code) || 0;
        if (now - lastTick > POLL_STALE_MS) {
          symbolLastTickRef.current.set(symbol.code, now);
          requestHistory(ws, symbol.code);
          idx = (idx + i + 1) % group.length;
          break;
        }
      }
    }, POLL_INTERVAL_MS);
    pollersRef.current.push(timer);
  }, [requestHistory]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    if (data.msg_type === 'history' && data.history) {
      const history = data.history as Record<string, unknown>;
      const prices = (history.prices as number[]) || [];
      const symbol = data.echo_req ? (data.echo_req as Record<string, string>).ticks_history : '';
      
      if (symbol && prices.length > 0) {
        const pipSize = (data.pip_size as number) || 4;
        const digits = prices.map(p => extractLastDigit(parseFloat(String(p)), pipSize));
        dataRef.current.set(symbol, digits);
        symbolLastTickRef.current.set(symbol, Date.now());
      }
    }

    if (data.msg_type === 'tick') {
      // Handle subscription rejections/errors (e.g. InvalidSymbol) gracefully.
      // The fallback history poller keeps the symbol data moving.
      if (data.error) {
        const failedSymbol = (data.echo_req as Record<string, unknown>)?.ticks as string | undefined;
        console.warn('[Scanner] Tick subscription failed for ' + (failedSymbol || 'unknown') + ':', data.error);
        if (failedSymbol) symbolLastTickRef.current.set(failedSymbol, 0);
        return;
      }

      if (data.tick) {
        const tick = data.tick as Record<string, unknown>;
        const symbol = tick.symbol as string;
        const price = parseFloat(String(tick.quote));
        const pipSize = (data.pip_size as number) || 4;

        const digit = extractLastDigit(price, pipSize);
        const currentTicks = dataRef.current.get(symbol) || [];
        currentTicks.push(digit);

        // Keep only last 1000 ticks
        if (currentTicks.length > 1000) {
          currentTicks.shift();
        }

        dataRef.current.set(symbol, currentTicks);
        symbolLastTickRef.current.set(symbol, Date.now());
      }
    }
  }, [extractLastDigit]);

  const start = useCallback(() => {
    if (wsRefs.current.some((ws) => ws.readyState === WebSocket.OPEN)) return;

    setIsRunning(true);
    setStartTime(new Date());

    // Split symbols across connections (one distinct app_id each) so every
    // connection gets its own ~220 req/min polling budget.
    const groups: typeof SYMBOLS[] = [];
    let cursor = 0;
    SCANNER_GROUP_SIZES.forEach((size) => {
      groups.push(SYMBOLS.slice(cursor, cursor + size));
      cursor += size;
    });

    groups.forEach((group, groupIndex) => {
      const ws = new WebSocket(`${DERIV_WS_URL}${SCANNER_APP_IDS[groupIndex % SCANNER_APP_IDS.length]}`);
      wsRefs.current.push(ws);

      ws.onopen = () => {
        setIsConnected(true);

        // Keep connection alive - Deriv drops idle connections
        const keepAlive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ ping: 1 })); } catch (e) {}
          }
        }, 30000);
        keepAlivesRef.current.set(ws, keepAlive);

        // Initial history + subscribe attempt, staggered so the burst isn't
        // dropped by the server.
        group.forEach((symbol, index) => {
          setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) return;
            requestHistory(ws, symbol.code);
            ws.send(JSON.stringify({
              ticks: symbol.code,
              subscribe: 1,
            }));
          }, index * 60);
        });

        startConnPollers(ws, group);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (e) {
          console.error('Parse error:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        const ka = keepAlivesRef.current.get(ws);
        if (ka) {
          clearInterval(ka);
          keepAlivesRef.current.delete(ws);
        }
      };
    });

    intervalRef.current = setInterval(updateSignals, 1000);
  }, [handleMessage, updateSignals, startConnPollers]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    pollersRef.current.forEach((timer) => clearInterval(timer));
    pollersRef.current = [];

    keepAlivesRef.current.forEach((timer) => clearInterval(timer));
    keepAlivesRef.current.clear();

    wsRefs.current.forEach((ws) => ws.close());
    wsRefs.current = [];
    dataRef.current.clear();
    previousPercentagesRef.current.clear();
    symbolLastTickRef.current.clear();

    setIsRunning(false);
    setIsConnected(false);
    setSignals([]);
    setActiveCount(0);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isRunning,
    isConnected,
    signals,
    activeCount,
    lastUpdate,
    startTime,
    start,
    stop,
  };
}
