import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';

interface LoginForm { email: string; password: string; }

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setLoading(true);
    try {
      await login(data.email, data.password);
      window.location.replace('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Anmeldung fehlgeschlagen');
    } finally { setLoading(false); }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0a0a0f 0%, #111118 45%, #0d0d15 100%)' }}
    >
      {/* Ambient glow — Apple blue */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '15%', left: '20%', width: '520px', height: '520px',
          background: 'radial-gradient(circle, rgba(0,113,227,0.12) 0%, transparent 65%)',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '10%', right: '15%', width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(0,113,227,0.07) 0%, transparent 65%)',
        }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />

      <div className="relative w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-[60px] h-[60px] mb-5"
            style={{
              background: 'linear-gradient(145deg, #147CE5 0%, #0071E3 100%)',
              borderRadius: '18px',
              boxShadow: '0 4px 20px rgba(0,113,227,0.45), 0 1px 0 rgba(255,255,255,0.15) inset',
            }}
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <h1 className="text-[26px] font-bold text-white tracking-tight" style={{ letterSpacing: '-0.022em' }}>
            Sanierungsprojekte
          </h1>
          <p className="text-[14px] mt-1.5 font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Professionelle Projektverwaltung
          </p>
        </div>

        {/* Login Card */}
        <div
          className="p-8"
          style={{
            background: 'rgba(255,255,255,0.97)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.30), 0 0 0 0.5px rgba(255,255,255,0.08)',
          }}
        >
          {error && (
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6 text-[13px]"
              style={{ background: '#FFF2F2', border: '1px solid rgba(220,38,38,0.20)', color: '#C0152A' }}
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">E-Mail-Adresse</label>
              <input
                {...register('email', {
                  required: 'E-Mail erforderlich',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Ungültige E-Mail' },
                })}
                type="email"
                autoComplete="email"
                className="input"
                placeholder="nutzer@firma.de"
              />
              {errors.email && (
                <p className="text-[12px] mt-1.5 font-medium" style={{ color: '#C0152A' }}>{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Passwort</label>
              <input
                {...register('password', { required: 'Passwort erforderlich' })}
                type="password"
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-[12px] mt-1.5 font-medium" style={{ color: '#C0152A' }}>{errors.password.message}</p>
              )}
            </div>

            <div className="flex justify-end" style={{ marginTop: '-8px' }}>
              <Link
                to="/forgot-password"
                className="text-[13px] font-medium transition-colors"
                style={{ color: '#0071E3' }}
              >
                Passwort vergessen?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ paddingTop: '11px', paddingBottom: '11px', fontSize: '15px' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Anmelden…
                </>
              ) : 'Anmelden'}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] mt-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © {new Date().getFullYear()} Sanierungsprojekte · Alle Rechte vorbehalten
        </p>
      </div>
    </div>
  );
}
