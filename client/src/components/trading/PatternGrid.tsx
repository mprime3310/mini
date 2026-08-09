import { cn } from '@/lib/utils';
import { PatternDigit } from '@/types/trading';

interface PatternGridProps {
  pattern: PatternDigit[];
  columns?: number;
}

export function PatternGrid({ pattern, columns = 15 }: PatternGridProps) {
  const getPatternStyles = (type: PatternDigit['type']) => {
    switch (type) {
      case 'E':
      case 'M':
      case 'OU':
        return 'bg-primary/90 text-primary-foreground';
      case 'O':
      case 'D':
      case 'UN':
        return 'bg-destructive/90 text-destructive-foreground';
      case 'UP':
        return 'bg-transparent text-primary font-bold';
      case 'DN':
        return 'bg-transparent text-destructive font-bold';
      case 'TIE':
        return 'bg-transparent text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getDisplayText = (type: PatternDigit['type']) => {
    switch (type) {
      case 'E': return 'E';
      case 'O': return 'O';
      case 'M': return 'M';
      case 'D': return 'D';
      case 'OU': return 'O';
      case 'UN': return 'U';
      case 'UP': return '↑';
      case 'DN': return '↓';
      case 'TIE': return '=';
      default: return '?';
    }
  };

  return (
    <div 
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {pattern.map((p, i) => (
        <div
          key={i}
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-all duration-200",
            getPatternStyles(p.type)
          )}
        >
          {getDisplayText(p.type)}
        </div>
      ))}
    </div>
  );
}
