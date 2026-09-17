import React, { useState } from 'react';
import { ServerCrash, AlertTriangle, RefreshCw, Lock, Terminal, ShieldAlert, WifiOff } from 'lucide-react';

interface TechnicalErrorViewProps {
  onUnlockOwner: (email: string, pass: string) => Promise<boolean>;
  onGoogleLogin: () => Promise<void>;
  ownerEmail: string;
}

export const TechnicalErrorView: React.FC<TechnicalErrorViewProps> = ({
  onUnlockOwner,
  onGoogleLogin,
  ownerEmail,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  
  const [adminEmail, setAdminEmail] = useState(ownerEmail);
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    setRetryFailed(false);
    setTimeout(() => {
      setIsRetrying(false);
      setRetryFailed(true);
    }, 1400);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminLoading(true);

    try {
      const cleanEmail = adminEmail.trim().toLowerCase();
      if (cleanEmail !== ownerEmail.toLowerCase()) {
        setAdminError('Technischer Fehler (Code 403): Nicht autorisiertes Benutzerkonto. Zugriff verweigert.');
        setAdminLoading(false);
        return;
      }

      const success = await onUnlockOwner(cleanEmail, adminPass);
      if (!success) {
        setAdminError('Ungültige Autorisierung: Das angegebene Inhaber-Passwort ist fehlerhaft.');
      }
    } catch (err: any) {
      setAdminError(err.message || 'Authentifizierungsfehler aufgetreten.');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070A0F] text-[#E2E8F0] font-sans flex flex-col justify-between selection:bg-red-500 selection:text-white">
      {/* Top simulated status header */}
      <header className="border-b border-[#1E293B] bg-[#0B111A]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="font-mono text-red-400 font-bold tracking-wider uppercase">
            STATUS: 503 SERVICE UNAVAILABLE
          </span>
        </div>
        <div className="font-mono text-[11px] text-[#64748B]">
          SERVER_ID: FCA-PROD-CLUSTER-EUW1
        </div>
      </header>

      {/* Main Error Box */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-2xl w-full bg-[#0D1522] border-2 border-red-900/60 rounded-2xl p-6 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
          {/* Subtle warning glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl -z-0 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Error Icon */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-red-950/40 border border-red-700/50 flex items-center justify-center text-red-500 mb-6 shadow-inner">
              <ServerCrash size={48} className="animate-pulse" />
            </div>

            {/* Error Code & Title */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/70 border border-red-800 text-red-400 text-xs font-mono font-bold mb-4">
              <AlertTriangle size={14} />
              FEHLERCODE: HTTP_503_BACKEND_DISCONNECTED
            </div>

            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-3">
              Technischer Systemfehler
            </h1>

            <p className="text-sm sm:text-base text-[#94A3B8] max-w-lg mb-6 leading-relaxed">
              Die Verbindung zum Anwendungs-Server konnte nicht hergestellt werden. Der Zugriff über diesen Link wurde systemseitig gesperrt, um Datenkonflikte zu verhindern. Die App steht derzeit nicht zur Verfügung.
            </p>

            {/* Technical Details Banner */}
            <div className="w-full bg-[#080D14] border border-[#1E293B] rounded-xl p-4 text-left font-mono text-xs text-[#94A3B8] mb-6 space-y-1.5">
              <div className="text-red-400 font-bold flex items-center gap-2">
                <WifiOff size={14} /> Verbindung abgelehnt (ERR_CONNECTION_REFUSED)
              </div>
              <div className="text-[11px] text-[#64748B]">
                Host: <span className="text-[#CBD5E1]">fc-auggen.internal.app</span>
              </div>
              <div className="text-[11px] text-[#64748B]">
                Sicherheitsrichtlinie: <span className="text-amber-400">ISOLATION_ACTIVE (Zugriff für externe Benutzer gesperrt)</span>
              </div>
              <div className="text-[11px] text-[#64748B]">
                Meldung: Serverwartung oder Datenbankknoten nicht erreichbar.
              </div>
            </div>

            {/* Retry Button */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center mb-4">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 disabled:opacity-50"
              >
                <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                {isRetrying ? 'Verbindung wird geprüft...' : 'Verbindung erneut prüfen'}
              </button>

              <button
                type="button"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="w-full sm:w-auto px-5 py-3.5 bg-[#162032] hover:bg-[#1E2D44] text-[#94A3B8] hover:text-white font-semibold rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 border border-[#23354E]"
              >
                <Terminal size={15} />
                {showDiagnostics ? 'Protokoll verbergen' : 'Fehlerprotokoll'}
              </button>
            </div>

            {/* Inhaber-Freischaltung (Samer Khaleel) */}
            <div className="w-full mt-4 pt-5 border-t border-[#1E293B] flex flex-col items-center">
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="w-full sm:w-auto px-7 py-3 bg-[#10B981] hover:bg-[#059669] active:scale-95 text-[#0A0E17] font-black rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                <Lock size={15} />
                Inhaber-Freischaltung (Samer Khaleel)
              </button>
              <span className="text-[11px] text-[#64748B] mt-2 font-mono">
                Nur für den Inhaber: Code eingeben, um die App sofort zu starten
              </span>
            </div>

            {retryFailed && (
              <div className="p-3 bg-red-950/60 border border-red-700/60 text-red-300 text-xs rounded-lg font-mono mb-4 w-full">
                ⚠️ Verbindungsaufbau fehlgeschlagen: Der Anwendungsserver antwortet nicht (Timeout nach 1400ms). Bitte später erneut versuchen.
              </div>
            )}

            {/* Simulated Diagnostic Logs */}
            {showDiagnostics && (
              <div className="w-full text-left bg-black/80 border border-[#223046] rounded-xl p-4 text-[11px] font-mono text-[#64748B] space-y-1 mt-2 overflow-x-auto">
                <div className="text-amber-400">[BOOT] Initializing socket layer...</div>
                <div className="text-red-400">[FATAL] 503 SERVICE_UNAVAILABLE: Remote cluster rejected handshake</div>
                <div className="text-red-400">[AUTH] External token unverified. Tenant isolation policy enforced.</div>
                <div>[INFO] Endpoint: /api/v2/fcauggen/live-stream</div>
                <div>[WARN] Retrying 0/3 with exponential backoff... FAILED</div>
                <div className="text-red-500 font-bold">[STOP] Application boot halted. UI components unmounted.</div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Discreet Footer with Administrator Verification */}
      <footer className="border-t border-[#162032] bg-[#070A0F] py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#475569]">
        <div>
          © FC Auggen 1928 e.V. – Alle Rechte vorbehalten.
        </div>
        
        {/* Subtle, unobtrusive Admin trigger for Samer Khaleel */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="text-[#475569] hover:text-[#94A3B8] transition flex items-center gap-1.5 font-mono text-[10px] hover:underline"
            title="Systemwartung"
          >
            <Lock size={11} />
            <span>Systemdiagnose (Admin-Zugang)</span>
          </button>
        </div>
      </footer>

      {/* Secure Inhaber-Unlock Modal (Accessible only by Samer Khaleel) */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#0F172A] border-2 border-red-800/80 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 text-[#F8FAFC] relative">
            <div className="flex justify-between items-center pb-4 border-b border-[#334155] mb-5">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="text-red-500" size={22} />
                <h3 className="font-black text-sm uppercase tracking-wider text-white">
                  Systeminhaber-Autorisierung
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminError(null);
                }}
                className="text-[#94A3B8] hover:text-white font-bold text-base p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#94A3B8] mb-5 leading-relaxed">
              Dieser Zugang ist ausschließlich für den Systeminhaber (<span className="text-amber-400 font-bold">{ownerEmail}</span>) reserviert. Unbefugte Zugriffsversuche werden verworfen.
            </p>

            {adminError && (
              <div className="p-3 bg-red-950/80 border border-red-700 text-red-300 text-xs rounded-lg font-bold mb-4">
                ⚠️ {adminError}
              </div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#94A3B8] mb-1">
                  Inhaber-E-Mail
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full border border-[#334155] p-2.5 rounded-lg font-mono text-xs bg-[#1E293B] text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#94A3B8] mb-1">
                  Inhaber-Passwort
                </label>
                <input
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="Master-Passwort eingeben"
                  className="w-full border border-[#334155] p-2.5 rounded-lg font-bold text-sm bg-[#1E293B] text-white focus:outline-none focus:border-red-500"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase rounded-lg tracking-wider transition shadow-lg disabled:opacity-50 mt-2"
              >
                {adminLoading ? 'Autorisiere...' : 'Als Inhaber entsperren'}
              </button>
            </form>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#334155]"></div>
              </div>
              <span className="relative bg-[#0F172A] px-3 text-[10px] uppercase font-bold text-[#64748B]">
                Oder via Google
              </span>
            </div>

            <button
              type="button"
              onClick={async () => {
                try {
                  setAdminLoading(true);
                  await onGoogleLogin();
                } catch (err: any) {
                  setAdminError(err.message || 'Google-Anmeldung fehlgeschlagen.');
                } finally {
                  setAdminLoading(false);
                }
              }}
              className="w-full py-2.5 px-4 border border-[#334155] rounded-lg bg-[#1E293B] hover:bg-[#28384E] text-white text-xs font-bold transition flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.68 14.93 1 12 1 7.35 1 3.39 3.68 1.48 7.62l3.78 2.93c.92-2.76 3.51-4.51 6.74-4.51z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.99 3.7-8.63z"/>
                <path fill="#FBBC05" d="M5.26 14.12c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31L1.48 6.57C.53 8.44 0 10.53 0 12.75s.53 4.31 1.48 6.18l3.78-2.93z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.1.74-2.51 1.18-4.23 1.18-3.23 0-5.82-1.75-6.74-4.51L1.48 16.8C3.39 20.32 7.35 23 12 23z"/>
              </svg>
              Mit Inhaber-Google-Konto autorisieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
