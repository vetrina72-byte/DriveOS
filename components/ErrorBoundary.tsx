import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white p-6 select-none">
          <div className="max-w-md w-full bg-zinc-900/90 border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold tracking-tight">Si è verificato un errore</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              L'infotainment ha riscontrato un problema imprevisto durante l'esecuzione dell'interfaccia.
            </p>
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 px-4 rounded-xl bg-white text-black font-bold text-sm transition-transform active:scale-95 hover:bg-zinc-200"
              >
                Riavvia Sistema
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="py-3 px-4 rounded-xl bg-white/10 text-white font-bold text-sm transition-transform active:scale-95 hover:bg-white/20"
              >
                Riprova
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
