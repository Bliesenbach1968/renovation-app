import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ICONS = {
  home: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  users: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  templates: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  logout: (
    <svg className="w-[17px] h-[17px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
  hamburger: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
  shield: (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 1.5l-9 4v5.25C3 16.05 7.05 21.15 12 22.5c4.95-1.35 9-6.45 9-11.75V5.5l-9-4z" />
    </svg>
  ),
};

const SIDEBAR_BG = '#0E1015';
const SIDEBAR_BORDER = 'rgba(255,255,255,0.07)';

const navItem = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-200 ${
    isActive
      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
      : 'text-white/45 hover:bg-white/[0.06] hover:text-white/80'
  }`;

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const handleLogout = () => { logout(); window.location.replace('/login'); };
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const close = () => setSidebarOpen(false);

  // Aktiven Abschnitt für mobile Top-Bar ableiten
  const pageTitle = location.pathname === '/' ? 'Dashboard'
    : location.pathname.includes('/admin/users') ? 'Nutzerverwaltung'
    : location.pathname.includes('/admin/templates') ? 'Vorlagen'
    : location.pathname.includes('/summary') ? 'Kostenkalkulation'
    : location.pathname.includes('/building') ? 'Gebäude'
    : location.pathname.includes('/timeline') ? 'Zeitplan'
    : location.pathname.includes('/containers') ? 'Container'
    : location.pathname.includes('/geruest') ? 'Gerüst'
    : location.pathname.includes('/kran') ? 'Kran'
    : 'Renova Plan';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F2F4F7' }}>

      {/* ── Mobile top bar ────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 inset-x-0 h-14 z-30 flex items-center gap-3 px-4"
        style={{ background: SIDEBAR_BG, borderBottom: `1px solid ${SIDEBAR_BORDER}` }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-white/60 hover:text-white p-1.5 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Menü öffnen"
        >
          {ICONS.hamburger}
        </button>
        <span className="text-white/90 text-[14px] font-semibold tracking-tight">{pageTitle}</span>
        <div className="ml-auto">
          <div
            className="w-8 h-8 flex items-center justify-center text-white text-[11px] font-bold rounded-full"
            style={{ background: 'linear-gradient(135deg, #2181FF 0%, #0052AD 100%)' }}
          >
            {initials}
          </div>
        </div>
      </div>

      {/* ── Mobile backdrop ───────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden" onClick={close} />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[232px] flex flex-col flex-shrink-0 transition-transform duration-300 md:relative md:z-auto md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: SIDEBAR_BG, borderRight: `1px solid ${SIDEBAR_BORDER}` }}
      >
        {/* Brand */}
        <div className="px-4 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: `1px solid ${SIDEBAR_BORDER}` }}>
          <div className="flex items-center justify-center">
            <img src="/logo.png" alt="Renova Plan Logo" className="h-[108px] w-auto object-contain" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

          {/* Hauptbereich */}
          <div className="mb-1">
            <p className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.22)' }}>
              Übersicht
            </p>
            <NavLink to="/" end className={navItem} onClick={close}>
              {ICONS.home}
              Dashboard
            </NavLink>
          </div>

          {isAdmin && (
            <div className="pt-3">
              <p className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.22)' }}>
                Administration
              </p>
              <div className="space-y-0.5">
                <NavLink to="/admin/users" className={navItem} onClick={close}>
                  {ICONS.users}
                  Nutzerverwaltung
                </NavLink>
                <NavLink to="/admin/templates" className={navItem} onClick={close}>
                  {ICONS.templates}
                  Vorlagen
                </NavLink>
              </div>
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="flex-shrink-0 px-3 py-3" style={{ borderTop: `1px solid ${SIDEBAR_BORDER}` }}>
          {/* Avatar card */}
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center text-white text-[11px] font-bold shrink-0 rounded-full"
              style={{ background: 'linear-gradient(135deg, #2181FF 0%, #0052AD 100%)', boxShadow: '0 2px 8px rgba(0,113,227,0.4)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[12.5px] font-semibold truncate leading-tight">{user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isAdmin && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                    style={{ background: 'rgba(0,113,227,0.25)', color: '#60A5FA' }}
                  >
                    {ICONS.shield}
                    Admin
                  </span>
                )}
                <p className="text-[10.5px] truncate leading-tight" style={{ color: 'rgba(255,255,255,0.30)' }}>
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-xl transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#F87171';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            {ICONS.logout}
            Abmelden
          </button>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
