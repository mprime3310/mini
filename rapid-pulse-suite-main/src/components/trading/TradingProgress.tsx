import { cn } from '@/lib/utils';

interface TradingProgressProps {
  step: 'idle' | 'proposing' | 'settling' | 'ready';
  lastResult?: 'win' | 'loss' | null;
}

export function TradingProgress({ step, lastResult }: TradingProgressProps) {
  const steps = [
    { id: 'proposing', label: 'Proposing', num: 1 },
    { id: 'settling', label: 'Settling', num: 2 },
    { id: 'ready', label: 'Ready', num: '✓' },
  ];

  const getStepIndex = () => {
    switch (step) {
      case 'proposing': return 0;
      case 'settling': return 1;
      case 'ready': return 2;
      default: return -1;
    }
  };

  const currentIndex = getStepIndex();
  const progressWidth = currentIndex < 0 ? 0 : ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="py-3">
      <div className="relative flex justify-between">
        {/* Background line */}
        <div className="absolute top-[10px] left-0 right-0 h-0.5 bg-muted/30" />
        
        {/* Progress line */}
        <div 
          className="absolute top-[10px] left-0 h-0.5 bg-secondary transition-all duration-300"
          style={{ width: `${progressWidth}%` }}
        />

        {/* Steps */}
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
    </div>
  );
}
