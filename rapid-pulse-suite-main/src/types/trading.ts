// Trading Types
export interface Symbol {
  code: string;
  name: string;
  isOneSecond?: boolean;
  group?: string;
}

export interface ScannerSignal {
  symbol: string;
  name: string;
  percentage: number;
  signal: 'EVEN' | 'ODD' | 'OVER' | 'UNDER';
  deviation: number;
  lastUpdate: Date | null;
  isOneSecond: boolean;
}

export interface DigitFrequency {
  digit: number;
  count: number;
  percentage: number;
  rank: 'most' | 'second-most' | 'least' | 'second-least' | 'normal';
}

export interface AnalyzerData {
  even: number;
  odd: number;
  over: number;
  under: number;
  matches: number;
  differs: number;
  rise: number;
  fall: number;
}

export interface PatternDigit {
  type: 'E' | 'O' | 'M' | 'D' | 'OU' | 'UN' | 'UP' | 'DN' | 'TIE';
  value?: number;
}

export interface Trade {
  id: number;
  type: string;
  entry: string;
  exit: string;
  stake: number;
  profit: number;
  status: 'Won' | 'Lost' | 'Open' | 'Pending';
  timestamp: Date;
}

export interface TradingSession {
  sessionPnL: number;
  consecutiveLosses: number;
  totalLosses: number;
  currentStake: number;
  strategy: 'manual' | 'horizontal' | 'alternate';
  horizontal: {
    sequence: { dir: number; barrier: number }[];
    currentIndex: number;
  };
  alternate: {
    nextDirection: number;
  };
}

export interface BotSettings {
  symbol: string;
  category: 'rise_fall' | 'matches_differs' | 'over_under' | 'even_odd';
  direction: string;
  barrier: number;
  ticks: number;
  stake: number;
  martingale: number;
  takeProfit: number;
  stopLoss: number;
  maxConsecutiveLosses: number;
  maxTotalLosses: number;
  strategy: 'manual' | 'horizontal' | 'alternate';
  predictionSequence: string;
}

export const SYMBOLS: Symbol[] = [
  // Standard Volatility
  { code: 'R_10', name: 'Volatility 10', group: 'Standard' },
  { code: 'R_25', name: 'Volatility 25', group: 'Standard' },
  { code: 'R_50', name: 'Volatility 50', group: 'Standard' },
  { code: 'R_75', name: 'Volatility 75', group: 'Standard' },
  { code: 'R_100', name: 'Volatility 100', group: 'Standard' },
  // 1-Second Volatility
  { code: '1HZ10V', name: 'V10 (1s)', isOneSecond: true, group: '1-Second' },
  { code: '1HZ15V', name: 'V15 (1s)', isOneSecond: true, group: '1-Second' },
  { code: '1HZ25V', name: 'V25 (1s)', isOneSecond: true, group: '1-Second' },
  { code: '1HZ30V', name: 'V30 (1s)', isOneSecond: true, group: '1-Second' },
  { code: '1HZ50V', name: 'V50 (1s)', isOneSecond: true, group: '1-Second' },
  { code: '1HZ75V', name: 'V75 (1s)', isOneSecond: true, group: '1-Second' },
  { code: '1HZ90V', name: 'V90 (1s)', isOneSecond: true, group: '1-Second' },
  { code: '1HZ100V', name: 'V100 (1s)', isOneSecond: true, group: '1-Second' },
  // Bull & Bear
  { code: '1HZ1BVOL100', name: 'Bull Market', group: 'Bull & Bear' },
  { code: '1HZ1AVOL100', name: 'Bear Market', group: 'Bull & Bear' },
  // Jump & Step
  { code: '1HZ10JVOL100', name: 'Jump 100', group: 'Jump & Step' },
  { code: '1HZ1S', name: 'Step Index', group: 'Jump & Step' },
];

export const CONTRACT_TYPES: Record<string, Record<string, string>> = {
  rise_fall: { rise: 'CALL', fall: 'PUT' },
  matches_differs: { matches: 'DIGITMATCH', differs: 'DIGITDIFF' },
  over_under: { over: 'DIGITOVER', under: 'DIGITUNDER' },
  even_odd: { even: 'DIGITEVEN', odd: 'DIGITODD' },
};
