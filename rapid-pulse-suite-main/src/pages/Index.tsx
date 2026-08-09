import { useState, useEffect } from 'react';
import { VolatilityScanner } from '@/components/trading/VolatilityScanner';
import { DigitFrequencyAnalyzer } from '@/components/trading/DigitFrequencyAnalyzer';
import { DigitAnalyzerV5 } from '@/components/trading/DigitAnalyzerV5';
import { TradingBot } from '@/components/trading/TradingBot';
import { cn } from '@/lib/utils';

type TabType = 'scanner' | 'frequency' | 'analyzer';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('scanner');
  const [marketTime, setMarketTime] = useState('--:--:-- UTC');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setMarketTime(now.toUTCString().split(' ')[4] + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'scanner' as const, icon: '📊', label: 'Scanner' },
    { id: 'frequency' as const, icon: '🔢', label: 'Frequency' },
    { id: 'analyzer' as const, icon: '📈', label: 'Analyzer' },
  ];

  return (
    <div className="min-h-screen bg-background p-2 md:p-4">
      {/* Mobile Layout */}
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 min-h-[calc(100vh-1rem)] lg:h-[calc(100vh-2rem)]">
        {/* Left Panel */}
        <div className="flex-1 lg:flex-[65] min-w-0 flex flex-col gap-3 lg:gap-4">
          {/* Header */}
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 md:p-4 bg-card rounded-xl border border-border/50 gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg md:text-xl font-extrabold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                MirukaG Pro Suite
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-secondary/10 text-secondary border border-secondary/30">
                PRO v4.0
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs md:text-sm font-medium">LIVE</span>
              </div>
              <span className="font-mono text-xs md:text-sm text-muted-foreground">{marketTime}</span>
            </div>
          </header>

          {/* Tabs */}
          <div className="flex bg-card rounded-xl border border-border/50 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 px-2 md:px-5 py-3 md:py-4 text-xs md:text-sm font-semibold flex items-center justify-center gap-1 md:gap-2 transition-all border-b-[3px]",
                  activeTab === tab.id
                    ? 'bg-primary/10 text-secondary border-secondary'
                    : 'text-muted-foreground border-transparent hover:bg-muted/30 hover:text-foreground'
                )}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0 overflow-auto">
            {activeTab === 'scanner' && <VolatilityScanner />}
            {activeTab === 'frequency' && <DigitFrequencyAnalyzer />}
            {activeTab === 'analyzer' && <DigitAnalyzerV5 />}
          </div>
        </div>

        {/* Panel Separator - Hidden on mobile */}
        <div className="hidden lg:block panel-separator" />

        {/* Right Panel - Trading Bot */}
        <div className="w-full lg:w-[380px] lg:min-w-[350px] lg:max-w-[450px] overflow-y-auto">
          <TradingBot />
        </div>
      </div>
    </div>
  );
};

export default Index;
