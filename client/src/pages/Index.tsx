import { useState, useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { VolatilityScanner } from '@/components/trading/VolatilityScanner';
import { DigitFrequencyAnalyzer } from '@/components/trading/DigitFrequencyAnalyzer';
import { DigitAnalyzerV5 } from '@/components/trading/DigitAnalyzerV5';
import { TradingBot } from '@/components/trading/TradingBot';
import { cn } from '@/lib/utils';

type TabType = 'scanner' | 'frequency' | 'analyzer';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('scanner');
  const [marketTime, setMarketTime] = useState('--:--:-- UTC');
  const [riseFallChart, setRiseFallChart] = useState(false);

  // Mobile Layout State
  const [analysisHeight, setAnalysisHeight] = useState(75); // Start at 75vh

  const handleResize = (clientY: number) => {
    const windowHeight = window.innerHeight;
    const newHeightVh = (clientY / windowHeight) * 100;
    // Enforce 50vh minimum (since it's now compact), allow expanding downwards
    if (newHeightVh >= 50 && newHeightVh <= 95) {
      setAnalysisHeight(newHeightVh);
    }
  };

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

  // Rise/Fall chart takes the whole panel: hide page chrome when active
  const showRiseFallFull = riseFallChart && activeTab === 'analyzer';

  return (
    <div className="min-h-screen p-2 md:p-4">
      {/* Mobile: Resizable Vertical Panels | Desktop: Fixed Horizontal Layout */}
      <div className="lg:hidden relative min-h-screen">
        {/* Fixed Analysis Panel */}
        <div
          className="fixed top-0 left-0 right-0 z-20 bg-background/60 backdrop-blur-2xl border-b border-white/10 shadow-xl flex flex-col transition-all duration-300 ease-out"
          style={{ height: `${analysisHeight}vh` }}
        >
          {/* Analysis Content Wrapper - Scaled for Consistently Small Text */}
          <div className="flex-1 min-h-0 flex flex-col origin-top" style={{ zoom: showRiseFallFull ? 1 : 0.8 }}>
            {/* Header */}
            {!showRiseFallFull && (
            <header className="flex-none flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 bg-card backdrop-blur-xl border-b border-white/10 gap-2">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                  MG Capital
                </h1>
                <span className="px-1 py-0.5 text-[9px] font-semibold rounded-full bg-secondary/10 text-secondary border border-secondary/30">
                  v4.0
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] font-medium">LIVE</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{marketTime}</span>
              </div>
            </header>
            )}

            {/* Tabs */}
            {!showRiseFallFull && (
            <div className="flex-none flex bg-card backdrop-blur-xl border-b border-white/10">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all border-b-2",
                    activeTab === tab.id
                      ? 'bg-primary/10 text-secondary border-secondary'
                      : 'text-muted-foreground border-transparent hover:bg-muted/30 hover:text-foreground'
                  )}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            )}

            {/* Tab Content Area */}
            <div className="flex-1 overflow-hidden bg-background/40 backdrop-blur-xl h-full">
              <div className={cn("h-full overflow-y-auto", showRiseFallFull ? "p-0" : "p-1")}>
                {activeTab === 'scanner' && <VolatilityScanner />}
                {activeTab === 'frequency' && <DigitFrequencyAnalyzer />}
                {activeTab === 'analyzer' && <DigitAnalyzerV5 onRiseFallChange={setRiseFallChart} />}
              </div>
            </div>
          </div>

          {/* Resize Handle - Thin and Effective */}
          <div
            className="flex-none h-2 bg-card backdrop-blur-xl border-t border-b border-border flex items-center justify-center touch-none cursor-row-resize active:bg-primary/20 transition-colors z-30"
            onTouchMove={(e) => handleResize(e.touches[0].clientY)}
            // Mouse events for testing on desktop simulation
            onMouseDown={(e) => {
              const handleMouseMove = (mw: MouseEvent) => handleResize(mw.clientY);
              const handleMouseUp = () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              };
              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="w-8 h-0.5 bg-muted-foreground/50 rounded-full" />
          </div>
        </div>

        {/* Scrollable Bot Panel (Behind) */}
        <div
          className="relative z-10 min-h-screen"
          style={{ paddingTop: `${analysisHeight}vh` }}
        >
          <div className="p-2 pb-20">
            <div className="bg-card backdrop-blur-xl rounded-xl border border-white/10">
              <div className="p-2 border-b border-border">
                <h3 className="text-xs font-bold flex items-center gap-2">
                  🤖 Trading Bot
                </h3>
              </div>
              <div className="p-1">
                <TradingBot />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout - Fixed (non-resizable) */}
      <div className="hidden lg:flex lg:flex-row gap-3 lg:gap-4 h-[calc(100vh-2rem)]">
        {/* Left Panel */}
        <div className="flex-1 lg:flex-[65] min-w-0 flex flex-col gap-3 lg:gap-4">
          {/* Header */}
          {!showRiseFallFull && (
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 md:p-4 bg-card backdrop-blur-xl rounded-xl border border-white/10 gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg md:text-xl font-extrabold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                MG Capital
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
          )}

          {/* Tabs */}
          {!showRiseFallFull && (
          <div className="flex bg-card backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
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
          )}

          {/* Tab Content */}
          <div className={cn("flex-1 min-h-0", showRiseFallFull ? "overflow-hidden" : "overflow-auto")}>
            {activeTab === 'scanner' && <VolatilityScanner />}
            {activeTab === 'frequency' && <DigitFrequencyAnalyzer />}
            {activeTab === 'analyzer' && <DigitAnalyzerV5 onRiseFallChange={setRiseFallChart} />}
          </div>
        </div>

        {/* Panel Separator */}
        <div className="panel-separator" />

        {/* Right Panel - Trading Bot */}
        <div className="w-[380px] min-w-[350px] max-w-[450px] overflow-y-auto">
          <TradingBot />
        </div>
      </div>
    </div>
  );
};

export default Index;
