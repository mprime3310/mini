import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0f1e',
          color: '#f87171',
          fontFamily: 'monospace',
          padding: 24,
        }}>
          <div style={{ maxWidth: 640, width: '100%' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Something went wrong</h2>
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
              background: 'rgba(0,0,0,0.4)',
              padding: 12,
              borderRadius: 8,
              color: '#fbbf24',
            }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                background: '#f87171',
                color: '#0a0f1e',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
