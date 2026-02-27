import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetLink, setResetLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      if (res.resetToken) {
        const url = `${window.location.origin}/reset-password?token=${res.resetToken}`;
        setResetLink(url);
      } else {
        setResetLink('no-user');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Fehler beim Abrufen des Reset-Links');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
        backgroundImage: `
          linear-gradient(135deg, #020617 0%, #0f172a 60%, #020617 100%),
          radial-gradient(circle at 25% 40%, rgba(13,148,136,0.15) 0%, transparent 55%),
          radial-gradient(circle at 75% 70%, rgba(20,184,166,0.10) 0%, transparent 50%)
        `,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl shadow-lg shadow-primary-600/25 mb-5">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Passwort zurücksetzen</h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Reset-Link anfordern</p>
        </div>

        <div className="bg-white rounded-2xl shadow-modal p-8">
          {resetLink === 'no-user' ? (
            <div className="text-center">
              <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-600 mb-5">
                Wenn diese E-Mail registriert ist, wurde ein Reset-Link generiert. Bitte wenden Sie sich an Ihren Administrator.
              </p>
              <Link to="/login" className="btn-primary w-full block text-center">Zurück zum Login</Link>
            </div>
          ) : resetLink ? (
            <div>
              <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-center mb-2">Reset-Link generiert</h3>
              <p className="text-sm text-slate-500 text-center mb-4">
                Kopieren Sie den Link und öffnen Sie ihn im Browser. Der Link ist <strong>1 Stunde</strong> gültig.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-600 break-all font-mono">{resetLink}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(resetLink); }}
                className="btn-secondary w-full mb-3 text-sm"
              >
                Link kopieren
              </button>
              <Link to={resetLink.replace(window.location.origin, '')} className="btn-primary w-full block text-center text-sm">
                Link direkt öffnen
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200/80 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <p className="text-sm text-slate-500 mb-5">
                Geben Sie Ihre E-Mail-Adresse ein, um einen Reset-Link zu erhalten.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">E-Mail-Adresse</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="input"
                    placeholder="nutzer@firma.de"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="btn-primary w-full py-3 text-sm"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Wird gesucht…
                    </>
                  ) : 'Reset-Link anfordern'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link to="/login" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                  Zurück zum Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
