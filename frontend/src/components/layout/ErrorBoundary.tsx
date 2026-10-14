import React, { Component, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] transition-colors duration-300">
          <div className="max-w-lg w-full mx-4">
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-10 text-center shadow-2xl">
              <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-rose-400" />
              </div>

              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6 leading-relaxed">
                An unexpected error occurred. You can try refreshing the page or navigate back to the dashboard.
              </p>

              {this.state.error && (
                <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-4 mb-6 text-left">
                  <p className="text-xs font-mono text-rose-300 break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <a
                  href="/"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-semibold hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Home
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
