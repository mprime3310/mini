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
  const pipSizeRef = useRef(4);
  const currentTickCountRef = useRef(tickCount);
  const currentAnalysisTypeRef = useRef(analysisType);
  const currentBarrierRef = useRef(barrier);

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

      if (prices.length > 0) {
        const lastPrice = parseFloat(prices[prices.length - 1]);
        setLivePrice(lastPrice.toFixed(pipSizeRef.current));
      }

      calculateStats();
    }

    if (data.msg_type === 'tick' && data.tick) {
      const tick = data.tick as Record<string, unknown>;
      const price = parseFloat(String(tick.quote));
      
      if (tick.pip_size !== undefined) {
        pipSizeRef.current = tick.pip_size as number;
      }
      
      setLivePrice(price.toFixed(pipSizeRef.current));

      ticksRef.current.push({ epoch: tick.epoch as number, quote: price });
      if (ticksRef.current.length > 1500) {
        ticksRef.current.shift();
      }

      calculateStats();
    }
  }, [calculateStats]);

  const connect = useCallback((newSymbol?: string) => {
    const targetSymbol = newSymbol || currentSymbol;
    
    if (wsRef.current) {
      wsRef.current.close();
    }

    ticksRef.current = [];
    setCurrentSymbol(targetSymbol);
    setLivePrice('Loading...');

    wsRef.current = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    wsRef.current.onopen = () => {
      setIsConnected(true);

      wsRef.current?.send(JSON.stringify({
        ticks_history: targetSymbol,
        end: 'latest',
        count: 1500,
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
    };
  }, [currentSymbol, handleMessage]);

  const disconnect = useCallback(() => {
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
