import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { FCAuggenCrest } from './FCAuggenCrest';

interface SessionLoginViewProps {
  ownerEmail: string;
  onUnlockOwner: (email: string, pass: string) => Promise<boolean>;
  onGoogleLogin: () => Promise<void>;
}

export const SessionLoginView: React.FC<SessionLoginViewProps> = ({
  ownerEmail,
  onUnlockOwner,
  onGoogleLogin
}) => {
  const [email, setEmail] = useState(ownerEmail);
  const [password, setPassword] = useState('0000');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== ownerEmail.toLowerCase()) {
        setError(`Zugriff verweigert: Nur das Inhaber-Konto ${ownerEmail} ist berechtigt.`);
        setLoading(false);
        return;
      }

      const ok = await onUnlockOwner(cleanEmail, password);
      if (!ok) {
        setError('Ungültiges Passwort / PIN. Bitte verwende das Inhaber-Passwort (Standard: 0000).');
      }
    } catch (err: any) {
      setError(err?.message || 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const ok = await onUnlockOwner(ownerEmail, '0000');
      if (!ok) {
        setError('Schnell-Anmeldung fehlgeschlagen. Bitte Passwort manuell eingeben.');
      }
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Schnell-Login.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await onGoogleLogin();
    } catch (err: any) {
      setError(err?.message || 'Google-Anmeldung fehlgeschlagen oder abgebrochen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070A0F] text-[#E2E8F0] font-sans flex flex-col justify-between selection:bg-[#C00000] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#1E293B] bg-[#0B111A]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center font-black text-black text-xs shadow-md border border-[#FBBF24]">
            FCA
          </div>
          <div>
            <span className="font-mono text-white font-bold tracking-wider uppercase text-sm block">
              FC AUGGEN 1926 e.V.
            </span>
            <span className="text-[10px] text-[#94A3B8] font-medium tracking-wide">
              Trainer- & Kader-Portal • Verbandsliga Südbaden
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#121824] px-3 py-1.5 rounded-full border border-[#1E293B] text-[11px] text-[#94A3B8]">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Sitzungssicherheit aktiv</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-[#0D1522] border-2 border-[#1E293B] hover:border-[#334155] transition-colors rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.7)] relative overflow-hidden">
          {/* Subtle Ambient Light */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 rounded-full blur-3xl -z-0 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center mb-6">
            {/* Crest / Logo */}
            <div className="mb-4">
              <FCAuggenCrest size={72} mode="crest" className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]" />
            </div>

            <h1 className="text-2xl font-black uppercase tracking-tight text-white mb-1">
              FC AUGGEN LOGIN
            </h1>
            <p className="text-xs text-[#94A3B8] font-medium">
              Interner Bereich für Trainer & Spielleitung
            </p>

            {/* Session Scope Notice */}
            <div className="mt-4 w-full bg-[#121B2B] border border-amber-500/30 rounded-xl p-3 text-left flex items-start gap-2.5">
              <Lock size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-[#CBD5E1] leading-relaxed">
                <span className="font-bold text-amber-300 block mb-0.5">
                  Login nur für diese Browsersession
                </span>
                Aus Sicherheitsgründen bleibt die Anmeldung nur für diese aktive Browsersitzung gültig. Bei jedem Neustart des Browsers meldest du dich wie gewünscht frisch an.
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-700/60 rounded-xl text-xs text-red-300 flex items-start gap-2 text-left">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5 text-left">
                Inhaber E-Mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#121824] border border-[#2A374A] rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition"
                placeholder="samerkhaleel720@gmail.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5 text-left">
                Inhaber Passwort / PIN
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#121824] border border-[#2A374A] rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition"
                placeholder="PIN (z.B. 0000)"
              />
            </div>

            {/* Main Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-700 to-[#C00000] hover:from-red-600 hover:to-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-[0_4px_16px_rgba(192,0,0,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <KeyRound size={15} />
              {loading ? 'Anmeldung läuft...' : '🔑 Für diese Session Anmelden'}
            </button>

            {/* 1-Click Quick Login for Owner */}
            <button
              type="button"
              onClick={handleQuickLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#162235] hover:bg-[#1E2E48] border border-[#2A3E5E] text-amber-300 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
              title="Direkter Schnellstart für Samer Khaleel mit Standard-PIN 0000"
            >
              <Sparkles size={14} className="text-amber-400" />
              ⚡ 1-Klick Schnellstart (Inhaber PIN: 0000)
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1E293B]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-[#64748B]">
              <span className="bg-[#0D1522] px-3">Oder mit Google</span>
            </div>
          </div>

          {/* Google Sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#121824] hover:bg-[#1A2332] border border-[#2A374A] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.68 14.93 1 12 1 7.35 1 3.39 3.68 1.48 7.62l3.78 2.93c.92-2.76 3.51-4.51 6.74-4.51z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.99 3.7-8.63z"/>
              <path fill="#FBBC05" d="M5.26 14.12c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31L1.48 6.57C.53 8.44 0 10.53 0 12.75s.53 4.31 1.48 6.18l3.78-2.93z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.1.74-2.51 1.18-4.23 1.18-3.23 0-5.82-1.75-6.74-4.51L1.48 16.8C3.39 20.32 7.35 23 12 23z"/>
            </svg>
            <span>Mit Google Inhaber-Konto anmelden</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] bg-[#070A0F] py-3 text-center text-[10px] text-[#64748B] font-mono">
        FC Auggen 1926 e.V. • Session-Security Engine • Verbandsliga Südbaden 2026/2027
      </footer>
    </div>
  );
};
