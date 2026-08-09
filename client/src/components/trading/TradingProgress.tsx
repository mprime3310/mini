import { cn } from '@/lib/utils';
import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';

interface TradingProgressProps {
  step: 'idle' | 'buying' | 'settling' | 'ready';
  lastResult?: 'win' | 'loss' | null;
}

export interface TradingProgressHandle {
  setTick: (current: number, total: number) => void;
  reset: () => void;
}

export const TradingProgress = forwardRef<TradingProgressHandle, TradingProgressProps>(({ step, lastResult }, ref) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const tickTextRef = useRef<HTMLSpanElement>(null);
  const currentTickRef = useRef(0);
  const totalTicksRef = useRef(0);

  useImperativeHandle(ref, () => ({
    setTick: (current, total) => {
      currentTickRef.current = current;
      totalTicksRef.current = total;
      
      if (progressBarRef.current) {
        const percentage = Math.min(100, (current / total) * 100);
        progressBarRef.current.style.width = `${percentage}%`;
      }
      if (tickTextRef.current) {
        tickTextRef.current.textContent = `${current} / ${total}`;
      }
    },
    reset: () => {
      currentTickRef.current = 0;
      totalTicksRef.current = 0;
      
      if (progressBarRef.current) progressBarRef.current.style.width = '0%';
      if (tickTextRef.current) tickTextRef.current.textContent = '- / -';
    }
  }));

  // Auto-complete progress bar when step becomes 'ready'
  useEffect(() => {
    if (step === 'ready' && progressBarRef.current) {
      progressBarRef.current.style.width = '100%';
      if (tickTextRef.current) {
        tickTextRef.current.textContent = '✓ Completed';
      }
    } else if (step === 'buying' && progressBarRef.current) {
      // Reset progress when buying starts
      progressBarRef.current.style.width = '0%';
      if (tickTextRef.current) {
        tickTextRef.current.textContent = '- / -';
      }
    }
  }, [step]);

  const steps = [
    { id: 'buying', label: 'Buying', num: 1 },
    { id: 'settling', label: 'Settling', num: 2 },
    { id: 'ready', label: 'Ready', num: '✓' },
  ];

  const getStepIndex = () => {
    switch (step) {
      case 'buying': return 0;
      case 'settling': return 1;
      case 'ready': return 2;
      default: return -1;
    }
  };

  const currentIndex = getStepIndex();
  const stepProgressWidth = currentIndex < 0 ? 0 : ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="py-3 space-y-4">
      {/* Steps Progress */}
      <div className="relative flex justify-between px-2">
        <div className="absolute top-[10px] left-0 right-0 h-0.5 bg-muted/30" />
        <div 
          className="absolute top-[10px] left-0 h-0.5 bg-secondary transition-all duration-300"
          style={{ width: `${stepProgressWidth}%` }}
        />
        {steps.map((s, i) => {
          const isActive = i === currentIndex;
          const isCompleted = i < currentIndex;
          const isResult = s.id === 'ready' && step === 'ready';

          return (
            <div key={s.id} className="flex flex-col items-center z-10">
              <div 
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300",
                  isActive 
                    ? 'bg-secondary shadow-[0_0_0_3px_rgba(0,180,180,0.3)]' 
                    : isCompleted 
                      ? 'bg-success' 
                      : 'bg-muted/30',
                  isResult && lastResult === 'win' && 'bg-success',
                  isResult && lastResult === 'loss' && 'bg-destructive'
                )}
              >
                <span className="text-white">{s.num}</span>
              </div>
              <span className={cn(
                "text-[9px] mt-1 transition-colors",
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Real-time Tick Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] uppercase text-muted-foreground font-semibold">
          <span>Tick Progress</span>
          <span ref={tickTextRef}>- / -</span>
        </div>
        <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
          <div 
            ref={progressBarRef}
            className={cn(
              "h-full transition-all ease-linear",
              step === 'ready' ? 'bg-success' : 'bg-primary'
            )}
            style={{ width: '0%', transitionDuration: step === 'ready' ? '300ms' : '100ms' }}
          />
        </div>
      </div>
    </div>
  );
});

TradingProgress.displayName = 'TradingProgress';
