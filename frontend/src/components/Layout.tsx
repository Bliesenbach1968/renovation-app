import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ICONS = {
  home: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  users: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  templates: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  logout: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
};

const navItem = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
    isActive
      ? 'bg-white/[0.12] text-white shadow-sm'
      : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
  }`;

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F5F5F7' }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className="w-[220px] flex flex-col flex-shrink-0"
        style={{
          background: '#1D1D1F',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Brand */}
        <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(145deg, #147CE5 0%, #0071E3 100%)',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,113,227,0.40)',
              }}
            >
              <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-white text-[13px] font-bold leading-tight tracking-tight">Sanierungsprojekte</p>
              <p className="text-[11px] leading-tight mt-0.5 font-medium" style={{ color: 'rgba(0,113,227,0.9)' }}>
                Projektverwaltung
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-3.5 space-y-0.5 overflow-y-auto">
          <NavLink to="/" end className={navItem}>
            {ICONS.home}
            Dashboard
          </NavLink>

          {isAdmin && (
            <>
              <div className="pt-4 pb-1.5 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  Administration
                </p>
              </div>
              <NavLink to="/admin/users" className={navItem}>
                {ICONS.users}
                Nutzerverwaltung
              </NavLink>
              <NavLink to="/admin/templates" className={navItem}>
                {ICONS.templates}
                Vorlagen
              </NavLink>
            </>
          )}
        </nav>

        {/* User section */}
        <div className="px-2.5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Avatar row */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 mb-1"
            style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center text-white text-[12px] font-bold shrink-0"
              style={{
                background: 'linear-gradient(145deg, #147CE5 0%, #0071E3 100%)',
                borderRadius: '50%',
              }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[12px] font-semibold truncate leading-tight">{user?.name}</p>
              <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-xl transition-all duration-150"
            style={{ color: 'rgba(255,255,255,0.40)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.40)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            {ICONS.logout}
            Abmelden
          </button>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
