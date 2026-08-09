import { useState, useCallback, useRef, useEffect } from 'react';
import { PatternDigit } from '@/types/trading';

interface UseDigitAnalyzerConfig {
  symbol?: string;
  tickCount?: number;
  analysisType?: 'evenodd' | 'overunder' | 'matchesdiffers' | 'risefall';
  barrier?: number;
}

interface AnalyzerStats {
  leftValue: number;
  leftLabel: string;
  rightValue: number;
  rightLabel: string;
  pattern: PatternDigit[];
}

export function useDigitAnalyzer(config: UseDigitAnalyzerConfig = {}) {
  const {
    symbol = 'R_100',
    tickCount = 120,
    analysisType = 'evenodd',
    barrier = 5
  } = config;

  const wsRef = useRef<WebSocket | null>(null);
  const ticksRef = useRef<{ epoch: number; quote: number }[]>([]);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pipSizeRef = useRef(4);
  const currentTickCountRef = useRef(tickCount);
  const currentAnalysisTypeRef = useRef(analysisType);
  const currentBarrierRef = useRef(barrier);
  const activeSymbolRef = useRef(symbol);
  const lastTickReceivedRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [currentTickCount, setCurrentTickCount] = useState(tickCount);
  const [currentAnalysisType, setCurrentAnalysisType] = useState(analysisType);
  const [currentBarrier, setCurrentBarrier] = useState(barrier);
  const [livePrice, setLivePrice] = useState<string>('Loading...');
  const [stats, setStats] = useState<AnalyzerStats>({
    leftValue: 50,
    leftLabel: 'Even',
    rightValue: 50,
    rightLabel: 'Odd',
    pattern: [],
  });

  // Keep refs in sync
  useEffect(() => { currentTickCountRef.current = currentTickCount; }, [currentTickCount]);
  useEffect(() => { currentAnalysisTypeRef.current = currentAnalysisType; }, [currentAnalysisType]);
  useEffect(() => { currentBarrierRef.current = currentBarrier; }, [currentBarrier]);

  const extractLastDigit = useCallback((price: number): number => {
    const formatted = price.toFixed(pipSizeRef.current);
    return parseInt(formatted.slice(-1));
  }, []);

  const calculateStats = useCallback(() => {
    const tickCount = currentTickCountRef.current;
    const analysisType = currentAnalysisTypeRef.current;
    const barrier = currentBarrierRef.current;

    const ticks = ticksRef.current.slice(-tickCount);
    if (ticks.length === 0) return;

    const digits = ticks.map(t => extractLastDigit(t.quote));
    const total = digits.length;

    let leftCount = 0;
    let rightCount = 0;
    let leftLabel = '';
    let rightLabel = '';
    const pattern: PatternDigit[] = [];

    switch (analysisType) {
      case 'evenodd':
        leftCount = digits.filter(d => d % 2 === 0).length;
        rightCount = total - leftCount;
        leftLabel = 'Even';
        rightLabel = 'Odd';
        // Last 45 for pattern
        digits.slice(-45).forEach(d => pattern.push({ type: d % 2 === 0 ? 'E' : 'O' }));
        break;

      case 'overunder':
        leftCount = digits.filter(d => d > barrier).length;
        rightCount = digits.filter(d => d < barrier).length;
        leftLabel = `Over ${barrier}`;
        rightLabel = `Under ${barrier}`;
        digits.slice(-45).forEach(d => {
          if (d > barrier) pattern.push({ type: 'OU' });
          else if (d < barrier) pattern.push({ type: 'UN' });
          else pattern.push({ type: 'TIE' });
        });
        break;

      case 'matchesdiffers':
        leftCount = digits.filter(d => d === barrier).length;
        rightCount = digits.filter(d => d !== barrier).length;
        leftLabel = `Matches ${barrier}`;
        rightLabel = `Differs ${barrier}`;
        digits.slice(-45).forEach(d => pattern.push({ type: d === barrier ? 'M' : 'D' }));
        break;

      case 'risefall':
        // For rise/fall we compare consecutive ticks
        for (let i = 1; i < ticks.length; i++) {
          if (ticks[i].quote > ticks[i - 1].quote) {
            leftCount++;
          } else if (ticks[i].quote < ticks[i - 1].quote) {
            rightCount++;
          }
        }
        // Pattern for last 45 comparisons
        const recentTicks = ticks.slice(-46);
        for (let i = 1; i < recentTicks.length; i++) {
          if (recentTicks[i].quote > recentTicks[i - 1].quote) {
            pattern.push({ type: 'UP' });
          } else if (recentTicks[i].quote < recentTicks[i - 1].quote) {
            pattern.push({ type: 'DN' });
          } else {
            pattern.push({ type: 'TIE' });
          }
        }
        leftLabel = 'Rise';
        rightLabel = 'Fall';
        break;
    }

    // Calculate percentages based on actual counts
    const actualTotal = analysisType === 'risefall' ? (ticks.length - 1) : total;
    const leftValue = actualTotal > 0 ? (leftCount / actualTotal) * 100 : 50;
    const rightValue = actualTotal > 0 ? (rightCount / actualTotal) * 100 : 50;

    setStats({
      leftValue,
      leftLabel,
      rightValue,
      rightLabel,
      pattern: pattern.slice(-45),
    });
  }, [extractLastDigit]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    if (data.msg_type === 'history' && data.history) {
      const history = data.history as Record<string, unknown>;
      const prices = (history.prices as string[]) || [];
      const times = (history.times as number[]) || [];

      if (data.pip_size !== undefined) {
        pipSizeRef.current = data.pip_size as number;
      }

      ticksRef.current = times.map((t, i) => ({
        epoch: t,
        quote: parseFloat(prices[i]),
      })).slice(-1500);

      lastTickReceivedRef.current = Date.now();

      if (prices.length > 0) {
        const lastPrice = parseFloat(prices[prices.length - 1]);
        setLivePrice(lastPrice.toFixed(pipSizeRef.current));
      }

      calculateStats();
    }

    if (data.msg_type === 'tick') {
      // Handle subscription rejection/errors gracefully.
      if (data.error) {
        console.warn('[Analyzer] Tick subscription failed:', data.error);
        lastTickReceivedRef.current = 0;
        return;
      }

      if (data.tick) {
        const tick = data.tick as Record<string, unknown>;
        const price = parseFloat(String(tick.quote));

        if (data.pip_size !== undefined) {
          pipSizeRef.current = data.pip_size as number;
        }

        lastTickReceivedRef.current = Date.now();

        setLivePrice(price.toFixed(pipSizeRef.current));

        ticksRef.current.push({ epoch: tick.epoch as number, quote: price });
        if (ticksRef.current.length > 1500) {
          ticksRef.current.shift();
        }

        calculateStats();
      }
    }
  }, [calculateStats]);

  // Fallback poller: when live ticks stop arriving (e.g. the server rejects
  // the tick subscription), refresh via one-shot ticks_history so the live
  // price and stats keep moving. Idle whenever live ticks are flowing.
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      if (
        Date.now() - lastTickReceivedRef.current > 1200 &&
        wsRef.current?.readyState === WebSocket.OPEN
      ) {
        wsRef.current.send(JSON.stringify({
          ticks_history: activeSymbolRef.current,
          end: 'latest',
          count: 300,
          style: 'ticks',
          adjust_start_time: 1,
        }));
      }
    }, 350);
  }, []);

  const connect = useCallback((newSymbol?: string) => {
    const targetSymbol = newSymbol || currentSymbol;

    activeSymbolRef.current = targetSymbol;
    lastTickReceivedRef.current = 0;
    startPolling();

    // Internal function to send initial requests
    const sendRequests = (ws: WebSocket, symbol: string) => {
      ws.send(JSON.stringify({
        ticks_history: symbol,
        end: 'latest',
        count: 1500,
        style: 'ticks',
        adjust_start_time: 1,
      }));

      ws.send(JSON.stringify({
        ticks: symbol,
        subscribe: 1,
      }));
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Reuse existing connection
      setCurrentSymbol(targetSymbol);
      setLivePrice('Loading...');
      ticksRef.current = []; // Clear ticks immediately

      // Forget previous tick streams first
      wsRef.current.send(JSON.stringify({
        forget_all: 'ticks'
      }));

      // Send new requests
      sendRequests(wsRef.current, targetSymbol);
      return;
    }

    // Otherwise, establish new connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    ticksRef.current = [];
    setCurrentSymbol(targetSymbol);
    setLivePrice('Loading...');

    wsRef.current = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=11941');

    wsRef.current.onopen = () => {
      setIsConnected(true);
      // Keep connection alive - Deriv drops idle connections
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      keepAliveRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try { wsRef.current.send(JSON.stringify({ ping: 1 })); } catch (e) {}
        }
      }, 30000);
      if (wsRef.current) {
        sendRequests(wsRef.current, targetSymbol);
      }
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
    };
  }, [currentSymbol, handleMessage, startPolling]);

  const disconnect = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  // Recalculate when settings change
  useEffect(() => {
    calculateStats();
  }, [currentTickCount, currentAnalysisType, currentBarrier, calculateStats]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    currentSymbol,
    currentTickCount,
    currentAnalysisType,
    currentBarrier,
    livePrice,
    stats,
    connect,
    disconnect,
    setTickCount: setCurrentTickCount,
    setAnalysisType: setCurrentAnalysisType,
    setBarrier: setCurrentBarrier,
    changeSymbol: connect,
  };
}
