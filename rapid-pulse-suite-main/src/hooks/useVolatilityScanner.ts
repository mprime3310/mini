import { useState, useCallback, useRef, useEffect } from 'react';
import { SYMBOLS, ScannerSignal } from '@/types/trading';

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

  const wsRef = useRef<WebSocket | null>(null);
  const dataRef = useRef<Map<string, number[]>>(new Map());
  const previousPercentagesRef = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    if (data.msg_type === 'history' && data.history) {
      const history = data.history as Record<string, unknown>;
      const prices = (history.prices as number[]) || [];
      const symbol = data.echo_req ? (data.echo_req as Record<string, string>).ticks_history : '';
      
      if (symbol && prices.length > 0) {
        const pipSize = (data.pip_size as number) || 4;
        const digits = prices.map(p => extractLastDigit(parseFloat(String(p)), pipSize));
        dataRef.current.set(symbol, digits);
      }
    }

    if (data.msg_type === 'tick' && data.tick) {
      const tick = data.tick as Record<string, unknown>;
      const symbol = tick.symbol as string;
      const price = parseFloat(String(tick.quote));
      const pipSize = (tick.pip_size as number) || 4;
      
      const digit = extractLastDigit(price, pipSize);
      const currentTicks = dataRef.current.get(symbol) || [];
      currentTicks.push(digit);
      
      // Keep only last 1000 ticks
      if (currentTicks.length > 1000) {
        currentTicks.shift();
      }
      
      dataRef.current.set(symbol, currentTicks);
    }
  }, [extractLastDigit]);

  const start = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    wsRef.current = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    wsRef.current.onopen = () => {
      setIsConnected(true);
      setIsRunning(true);
      setStartTime(new Date());

      // Request history and subscribe to all symbols
      SYMBOLS.forEach(symbol => {
        wsRef.current?.send(JSON.stringify({
          ticks_history: symbol.code,
          end: 'latest',
          count: 1000,
          style: 'ticks',
          adjust_start_time: 1,
        }));

        wsRef.current?.send(JSON.stringify({
          ticks: symbol.code,
          subscribe: 1,
        }));
      });

      // Start refresh interval
      intervalRef.current = setInterval(updateSignals, 1000);
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
      setIsRunning(false);
    };
  }, [handleMessage, updateSignals]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    wsRef.current?.close();
    wsRef.current = null;
    dataRef.current.clear();
    previousPercentagesRef.current.clear();
    
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
