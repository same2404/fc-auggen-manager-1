import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Ein unerwarteter Fehler ist aufgetreten.';
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Datenbank-Fehler: ${parsed.error}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="min-h-screen bg-[#121824] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1E293B] border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-black">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-4">Hoppla!</h1>
            <p className="text-[#94A3B8] mb-8 font-bold">
              {isFirestoreError ? errorMessage : 'Etwas ist schief gelaufen. Bitte versuche die Seite neu zu laden.'}
            </p>
            <button
              onClick={this.handleReset}
              className="w-full bg-black text-white py-4 px-6 font-black uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center gap-3 border-2 border-black"
            >
              <RefreshCw size={20} /> Seite neu laden
            </button>
            {isFirestoreError && (
              <p className="mt-6 text-[10px] text-gray-400 uppercase font-black tracking-widest">
                Bitte prüfe deine Internetverbindung oder Berechtigungen.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
