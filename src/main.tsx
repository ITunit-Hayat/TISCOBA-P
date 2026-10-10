import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 text-center font-sans">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl max-w-md w-full border border-neutral-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              !
            </div>
            <h1 className="text-lg font-bold text-neutral-900 mb-2">
              حدث خطأ في تحميل التطبيق
            </h1>
            <p className="text-sm text-neutral-600 mb-4">
              Une erreur est survenue lors du chargement. Veuillez rafraîchir la page ou réinitialiser les données en cache.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs text-left bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-red-600 mb-4 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white font-medium rounded-xl transition text-sm"
              >
                إعادة تحميل الصفحة (Recharger)
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.clear();
                  } catch {}
                  window.location.reload();
                }}
                className="w-full py-2 px-4 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 font-medium rounded-xl transition text-xs"
              >
                تفريغ الذاكرة المحلية وإعادة المحاولة (Effacer le cache)
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
