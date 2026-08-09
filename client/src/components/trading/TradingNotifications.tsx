import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// =====================================
// EXTREMELY DETAILED TRADING NOTIFICATION SYSTEM PROMPT
// =====================================

interface NotificationState {
  type: 'enhanced' | 'simple' | null;
  data: {
    profit?: number;
    target?: number;
    title?: string;
    message?: string;
  } | null;
}

let notificationState: NotificationState = { type: null, data: null };
let listeners: Set<() => void> = new Set();

const notify = (state: NotificationState) => {
  notificationState = state;
  listeners.forEach(listener => listener());
};

export const closeNotification = () => {
  notify({ type: null, data: null });
};

// Function 1: showTakeProfitNotification(profit, target)
export const showTakeProfitNotification = (
  profit: number,
  target: number
) => {
  // ⚡ Shows centered enhanced notification IMMEDIATELY
  // 🚫 NO calculations for win rate or number of runs
  // 🚫 NO audio playback
  // 🚫 NO auto-close timer

  notify({
    type: 'enhanced',
    data: { profit, target },
  });
};

// Function 2: showLossNotification(type, amount)
export const showLossNotification = (
  type: 'stop_loss' | 'consecutive_losses' | 'total_losses',
  amount: number
) => {
  // ⚡ Shows centered simple notification IMMEDIATELY
  // 🚫 NO audio playback
  // 🚫 NO auto-close timer

  let title = '';
  let message = '';

  switch (type) {
    case 'stop_loss':
      title = 'Stop Loss Triggered';
      message = `Your session has reached the stop loss limit of $${amount.toFixed(2)}. Trading has been stopped to protect your account.`;
      break;
    case 'consecutive_losses':
      title = 'Max Consecutive Losses';
      message = `You have reached the maximum consecutive losses limit (${amount}). Trading has been stopped to prevent further losses.`;
      break;
    case 'total_losses':
      title = 'Max Total Losses';
      message = `You have reached the maximum total losses limit (${amount}). Trading has been stopped.`;
      break;
  }

  notify({
    type: 'simple',
    data: { title, message },
  });
};

export function TradingNotifications() {
  const [state, setState] = useState<NotificationState>(notificationState);
  const enhancedRef = useRef<HTMLDivElement>(null);
  const simpleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = () => {
      setState({ ...notificationState });
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.type) {
        closeNotification();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [state.type]);

  if (!state.type) return null;

  return (
    <>
      {/* Enhanced Notification (Take Profit) */}
      {state.type === 'enhanced' && state.data && (
        <div
          ref={enhancedRef}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
        >
          {/* Enhanced Modal */}
          <div
            className="w-full max-w-[450px] rounded-xl p-[30px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-[fade-in_0.2s_ease]"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(99, 102, 241, 0.15))',
              border: '2px solid var(--success)',
            }}
          >
            {/* Emoji Centered above title */}
            <div className="text-center mb-4">
              <div className="text-[60px] leading-none mb-3">🎯</div>
              <h3 className="text-xl font-bold text-success mb-2">Take Profit Achieved!</h3>
            </div>

            {/* SIMPLIFIED: Single large profit display only */}
            <div className="flex flex-col items-center justify-center mb-6">
              <div
                className="text-5xl font-bold text-success mb-2"
                id="profitAmount"
              >
                ${state.data.profit?.toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
                Profit Earned
              </div>
            </div>

            <button
              id="enhancedBtn"
              onClick={closeNotification}
              className="w-full py-3 px-4 bg-success hover:bg-success/90 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Simple Notification (Losses) */}
      {state.type === 'simple' && state.data && (
        <div
          ref={simpleRef}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
        >
          {/* Simple Modal */}
          <div
            className="w-full max-w-[450px] rounded-xl p-[30px] animate-[fade-in_0.2s_ease]"
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <h3
              className="text-xl font-bold mb-3 text-center"
              style={{ color: 'var(--danger)' }}
            >
              {state.data.title}
            </h3>
            <p
              className="text-sm text-center mb-6 leading-relaxed"
              style={{ color: 'rgba(248, 250, 252, 0.8)' }} // var(--text-light) with 80% opacity
            >
              {state.data.message}
            </p>
            <button
              id="simpleBtn"
              onClick={closeNotification}
              className="w-full py-3 px-4 border-2 border-danger text-destructive hover:bg-destructive/10 font-semibold rounded-lg transition-colors duration-200"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </>
  );
}
