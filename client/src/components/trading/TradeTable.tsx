import { cn } from '@/lib/utils';
import { Trade } from '@/types/trading';

interface TradeTableProps {
  trades: Trade[];
  onClear?: () => void;
}

export function TradeTable({ trades, onClear }: TradeTableProps) {
  const displayTrades = trades.slice(-8).reverse();

  return (
    <div className="space-y-3">
      {/* Header with clear button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Trade History</h3>
        {trades.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs px-2 py-1 rounded bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-40">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card/95">
            <tr className="border-b border-border/50">
              <th className="px-2 py-2 text-left text-secondary font-semibold">Type</th>
              <th className="px-2 py-2 text-left text-secondary font-semibold">Entry</th>
              <th className="px-2 py-2 text-left text-secondary font-semibold">Exit</th>
              <th className="px-2 py-2 text-left text-secondary font-semibold">Stake</th>
              <th className="px-2 py-2 text-left text-secondary font-semibold">P/L</th>
              <th className="px-2 py-2 text-left text-secondary font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {displayTrades.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                  No trades yet
                </td>
              </tr>
            ) : (
              displayTrades.map((trade) => (
                <tr 
                  key={trade.id} 
                  className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                >
                  <td className="px-2 py-2 font-medium">{trade.type}</td>
                  <td className="px-2 py-2 font-mono">{trade.entry}</td>
                  <td className="px-2 py-2 font-mono">{trade.exit}</td>
                  <td className="px-2 py-2 font-mono">${trade.stake.toFixed(2)}</td>
                  <td className={cn(
                    "px-2 py-2 font-mono font-bold",
                    trade.profit >= 0 ? 'text-success' : 'text-destructive'
                  )}>
                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                  </td>
                  <td className="px-2 py-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                      trade.status === 'Won' 
                        ? 'bg-success/20 text-success' 
                        : trade.status === 'Lost'
                          ? 'bg-destructive/20 text-destructive'
                          : 'bg-secondary/20 text-secondary'
                    )}>
                      {trade.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
