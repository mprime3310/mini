import { useState, useCallback, useRef, useEffect } from 'react';
import { DigitFrequency } from '@/types/trading';

interface UseDigitFrequencyConfig {
  symbol?: string;
  period?: number;
}

export function useDigitFrequency(config: UseDigitFrequencyConfig = {}) {
  const { symbol = 'R_25', period = 1000 } = config;

  const wsRef = useRef<WebSocket | null>(null);
  const tickHistoryRef = useRef<number[]>([]);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countsRef = useRef<Record<number, number>>({ 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 });
  const activeSymbolRef = useRef(symbol);
  const lastTickReceivedRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [currentPeriod, setCurrentPeriod] = useState(period);
  const [livePrice, setLivePrice] = useState<string>('Loading...');
  const [currentDigit, setCurrentDigit] = useState<number | null>(null);
  const [frequencies, setFrequencies] = useState<DigitFrequency[]>([]);
  const [mostFrequent, setMostFrequent] = useState<{ digit: number; percentage: number } | null>(null);
  const [leastFrequent, setLeastFrequent] = useState<{ digit: number; percentage: number } | null>(null);

  const extractLastDigit = useCallback((price: number, pipSize: number = 4): number => {
    const formatted = price.toFixed(pipSize);
    return parseInt(formatted.slice(-1));
  }, []);

  const updateAnalysis = useCallback(() => {
    const totalTicks = Math.min(tickHistoryRef.current.length, currentPeriod);
    if (totalTicks === 0) return;

    const digitData: DigitFrequency[] = [];
    
    for (let digit = 0; digit <= 9; digit++) {
      const count = countsRef.current[digit];
      const percentage = (count / totalTicks) * 100;
      digitData.push({ digit, count, percentage, rank: 'normal' });
    }

    // Sort and assign ranks
    const sorted = [...digitData].sort((a, b) => b.percentage - a.percentage);
    
    sorted.forEach((item, index) => {
      if (index === 0) item.rank = 'most';
      else if (index === 1) item.rank = 'second-most';
      else if (index === 8) item.rank = 'second-least';
      else if (index === 9) item.rank = 'least';
      else item.rank = 'normal';
    });

    // Update frequencies with ranks
    digitData.forEach(d => {
      const ranked = sorted.find(s => s.digit === d.digit);
      if (ranked) d.rank = ranked.rank;
    });

    setFrequencies(digitData);
    setMostFrequent({ digit: sorted[0].digit, percentage: sorted[0].percentage });
    setLeastFrequent({ digit: sorted[9].digit, percentage: sorted[9].percentage });
  }, [currentPeriod]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    if (data.msg_type === 'history' && data.history) {
      const history = data.history as Record<string, unknown>;
      const prices = (history.prices as string[]) || [];
      const pipSize = (data.pip_size as number) || 4;

      // Reset counters
      countsRef.current = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 };
      tickHistoryRef.current = [];

      prices.forEach(p => {
        const price = parseFloat(p);
        const digit = extractLastDigit(price, pipSize);
        tickHistoryRef.current.push(digit);
        countsRef.current[digit]++;
      });

      // Trim to the active period window so the rolling counters stay consistent
      while (tickHistoryRef.current.length > currentPeriod) {
        const oldDigit = tickHistoryRef.current.shift()!;
        countsRef.current[oldDigit]--;
      }

      lastTickReceivedRef.current = Date.now();

      if (prices.length > 0) {
        const lastPrice = parseFloat(prices[prices.length - 1]);
        setLivePrice(lastPrice.toFixed(pipSize));
        setCurrentDigit(extractLastDigit(lastPrice, pipSize));
      }

      updateAnalysis();
    }

    if (data.msg_type === 'tick') {
      // Handle subscription rejection/errors gracefully.
      if (data.error) {
        console.warn('[Freq] Tick subscription failed:', data.error);
        lastTickReceivedRef.current = 0;
        return;
      }

      if (data.tick) {
        const tick = data.tick as Record<string, unknown>;
        const price = parseFloat(String(tick.quote));
        const pipSize = (data.pip_size as number) || 4;
        
        setLivePrice(price.toFixed(pipSize));
        
        const digit = extractLastDigit(price, pipSize);
        setCurrentDigit(digit);

        // Update history
        tickHistoryRef.current.push(digit);
        
        if (tickHistoryRef.current.length > currentPeriod) {
          const oldDigit = tickHistoryRef.current.shift()!;
          countsRef.current[oldDigit]--;
        }
        
        countsRef.current[digit]++;
        lastTickReceivedRef.current = Date.now();
        updateAnalysis();
      }
    }
  }, [extractLastDigit, currentPeriod, updateAnalysis]);

  // Fallback poller: when live ticks stop arriving (e.g. the server rejects
  // the tick subscription), refresh via one-shot ticks_history so the live
  // price and digit frequencies keep moving. Idle whenever ticks flow.
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
          count: 1000,
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
    
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Reset data
    tickHistoryRef.current = [];
    countsRef.current = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 };
    setCurrentSymbol(targetSymbol);
    setLivePrice('Loading...');

    wsRef.current = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=23925');

    wsRef.current.onopen = () => {
      setIsConnected(true);
      // Keep connection alive - Deriv drops idle connections
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      keepAliveRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try { wsRef.current.send(JSON.stringify({ ping: 1 })); } catch (e) {}
        }
      }, 30000);

      wsRef.current?.send(JSON.stringify({
        ticks_history: targetSymbol,
        end: 'latest',
        count: 1000,
        style: 'ticks',
        adjust_start_time: 1,
      }));

      wsRef.current?.send(JSON.stringify({
        ticks: targetSymbol,
        subscribe: 1,
      }));
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

  const changePeriod = useCallback((newPeriod: number) => {
    setCurrentPeriod(newPeriod);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    currentSymbol,
    currentPeriod,
    livePrice,
    currentDigit,
    frequencies,
    mostFrequent,
    leastFrequent,
    connect,
    disconnect,
    changePeriod,
    changeSymbol: connect,
  };
}
