import { cn } from '@/lib/utils';

interface DigitCircleProps {
  digit: number;
  percentage: number;
  rank: 'most' | 'second-most' | 'least' | 'second-least' | 'normal';
  isActive?: boolean;
}

export function DigitCircle({ digit, percentage, rank, isActive }: DigitCircleProps) {
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
    <div className="flex flex-col items-center relative min-h-[100px] md:min-h-[130px]">
      {/* Cursor indicator */}
      <div 
        className={cn(
          "absolute -top-1 md:-top-2 left-1/2 -translate-x-1/2 text-lg md:text-2xl text-destructive z-10 transition-opacity duration-300",
          isActive ? "opacity-100 cursor-active" : "opacity-0"
        )}
        style={{ filter: isActive ? 'drop-shadow(0 0 10px hsl(var(--destructive)))' : 'none' }}
      >
        🔻
      </div>
      
      {/* Circle */}
      <div 
        className={cn(
          "w-[50px] h-[50px] md:w-[70px] md:h-[70px] rounded-full flex items-center justify-center text-lg md:text-2xl font-bold text-white transition-all duration-300 mt-1 md:mt-2",
          getRankStyles()
        )}
        title={`Digit ${digit}: ${percentage.toFixed(2)}%`}
      >
        {digit}
      </div>
      
      {/* Percentage */}
      <div className="text-center mt-1 md:mt-2">
        <div className="text-xs md:text-base font-bold text-foreground">{percentage.toFixed(1)}%</div>
      </div>
    </div>
  );
}
