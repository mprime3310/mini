import { cn } from '@/lib/utils';

interface DigitCircleProps {
  digit: number;
  percentage: number;
  rank: 'most' | 'second-most' | 'least' | 'second-least' | 'normal';
  isActive?: boolean;
  compact?: boolean;
}

export function DigitCircle({ digit, percentage, rank, isActive, compact = false }: DigitCircleProps) {
  const getRankStyles = () => {
    switch (rank) {
      case 'most':
        return 'bg-gradient-to-br from-emerald-400 to-emerald-600 glow-green border-2 border-emerald-300/50';
      case 'second-most':
        return 'bg-gradient-to-br from-blue-400 to-blue-600 glow-blue border-2 border-blue-300/50';
      case 'least':
        return 'bg-gradient-to-br from-red-400 to-red-600 glow-red border-2 border-red-300/50';
      case 'second-least':
        return 'bg-gradient-to-br from-yellow-400 to-yellow-600 glow-yellow border-2 border-yellow-600/50 text-gray-900';
      default:
        return 'bg-gradient-to-br from-gray-500 to-gray-700 border-2 border-gray-500/30';
    }
  };

  return (
    <div className={cn("flex flex-col items-center relative", compact ? "min-h-[60px]" : "min-h-[100px] md:min-h-[130px]")}>
      {/* Cursor indicator */}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 text-destructive z-10 transition-opacity duration-300",
          isActive ? "opacity-100 cursor-active" : "opacity-0",
          compact ? "-top-1 text-sm" : "-top-1 md:-top-2 text-lg md:text-2xl"
        )}
        style={{ filter: isActive ? 'drop-shadow(0 0 10px hsl(var(--destructive)))' : 'none' }}
      >
        🔻
      </div>

      {/* Circle */}
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold text-white transition-all duration-300",
          compact ? "w-[32px] h-[32px] text-sm mt-1" : "w-[50px] h-[50px] md:w-[70px] md:h-[70px] text-lg md:text-2xl mt-1 md:mt-2",
          getRankStyles()
        )}
        title={`Digit ${digit}: ${percentage.toFixed(2)}%`}
      >
        {digit}
      </div>

      {/* Percentage */}
      <div className={cn("text-center", compact ? "mt-0.5" : "mt-1 md:mt-2")}>
        <div className={cn("font-bold text-foreground", compact ? "text-[10px]" : "text-xs md:text-base")}>{percentage.toFixed(1)}%</div>
      </div>
    </div>
  );
}
