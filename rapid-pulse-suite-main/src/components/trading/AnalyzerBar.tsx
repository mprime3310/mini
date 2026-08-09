import { cn } from '@/lib/utils';

interface AnalyzerBarProps {
  value: number;
  label: string;
  type: 'positive' | 'negative';
  maxHeight?: number;
}

export function AnalyzerBar({ value, label, type, maxHeight = 300 }: AnalyzerBarProps) {
  const height = (value / 100) * maxHeight;
  
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Label */}
      <div className="flex flex-col items-center text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          "font-bold text-lg",
          type === 'positive' ? 'text-primary' : 'text-destructive'
        )}>
          {value.toFixed(1)}%
        </span>
      </div>
      
      {/* Bar container */}
      <div 
        className="w-[120px] bg-muted/30 rounded-t-lg overflow-hidden relative"
        style={{ height: maxHeight }}
      >
        {/* Bar fill */}
        <div 
          className={cn(
            "absolute bottom-0 w-full rounded-t-lg bar-transition",
            type === 'positive' 
              ? 'bg-gradient-to-t from-primary to-blue-400' 
              : 'bg-gradient-to-t from-destructive to-red-400'
          )}
          style={{ 
            height: `${height}px`,
            boxShadow: `inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.2)`
          }}
        >
          {/* Inner percentage label */}
          <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm drop-shadow-md">
            {value.toFixed(0)}%
          </div>
        </div>
        
        {/* Border effect */}
        <div className="absolute inset-0 border border-border/50 rounded-t-lg pointer-events-none" />
      </div>
    </div>
  );
}
