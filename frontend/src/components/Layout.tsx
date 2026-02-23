import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItem = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-primary-700 text-white' : 'text-primary-100 hover:bg-primary-700 hover:text-white'
  }`;

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-primary-800 flex flex-col flex-shrink-0">
        <div className="px-4 py-5 border-b border-primary-700">
          <h1 className="text-white font-bold text-lg leading-tight">Sanierungsprojekte</h1>
          <p className="text-primary-300 text-xs mt-0.5">Projektverwaltung</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavLink to="/" end className={navItem}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Dashboard
          </NavLink>

          {isAdmin && (
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">Administration</p>
              <NavLink to="/admin/users"     className={navItem}>Nutzerverwaltung</NavLink>
              <NavLink to="/admin/templates" className={navItem}>Vorlagen</NavLink>
            </div>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-primary-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-primary-300 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full text-left text-primary-300 hover:text-white text-sm px-2 py-1 rounded hover:bg-primary-700 transition-colors">
            Abmelden
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
