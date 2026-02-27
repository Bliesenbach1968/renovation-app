import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { getUsers, registerUser, deleteUser, resetUserPassword } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator', projectLeader: 'Projektleiter', calculator: 'Kalkulator',
  worker: 'Ausführend', external: 'Extern (Lesend)',
};

function ResetPasswordModal({ user, onClose }: { user: { id: string; name: string }; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation(
    () => resetUserPassword(user.id, pw),
    {
      onSuccess: () => setSuccess(true),
    }
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6">
        <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        </div>

        {success ? (
          <>
            <h3 className="font-bold text-slate-900 text-center mb-2">Passwort gesetzt</h3>
            <p className="text-sm text-slate-600 text-center mb-5">
              Das neue Passwort für <span className="font-semibold">"{user.name}"</span> wurde erfolgreich gespeichert.
            </p>
            <button onClick={onClose} className="btn-primary w-full">Schließen</button>
          </>
        ) : (
          <>
            <h3 className="font-bold text-slate-900 text-center mb-1">Passwort zurücksetzen</h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              Neues Passwort für <span className="font-semibold">"{user.name}"</span> festlegen
            </p>

            {mutation.isError && (
              <p className="text-xs text-red-600 text-center mb-3">
                {(mutation.error as any)?.response?.data?.message || 'Fehler beim Speichern'}
              </p>
            )}

            <div className="mb-5">
              <label className="label">Neues Passwort</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="input pr-10"
                  placeholder="mind. 8 Zeichen"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {show ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {pw.length > 0 && pw.length < 8 && (
                <p className="text-xs text-amber-600 mt-1">Mindestens 8 Zeichen erforderlich</p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
              <button
                onClick={() => mutation.mutate()}
                disabled={pw.length < 8 || mutation.isLoading}
                className="btn-primary flex-1"
              >
                {mutation.isLoading ? 'Speichern…' : 'Passwort setzen'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [resetPwUser, setResetPwUser] = useState<{ id: string; name: string } | null>(null);

  if (!isAdmin) { navigate('/'); return null; }

  const { data: users = [], isLoading } = useQuery('users', getUsers);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: '', email: '', password: '', role: 'worker' },
  });

  const createMutation = useMutation(registerUser, {
    onSuccess: () => { qc.invalidateQueries('users'); setShowForm(false); reset(); },
  });

  const deleteMutation = useMutation(deleteUser, {
    onSuccess: () => { qc.invalidateQueries('users'); setConfirmDelete(null); },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nutzerverwaltung</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Nutzer anlegen</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Neuen Nutzer anlegen</h2>
          {createMutation.error != null && (
            <div className="bg-red-50 text-red-700 text-sm border border-red-200 rounded px-3 py-2 mb-3">
              {(createMutation.error as any).response?.data?.message}
            </div>
          )}
          <form onSubmit={handleSubmit((data) => createMutation.mutate(data as any))} className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input {...register('name', { required: true })} className="input" placeholder="Max Mustermann" />
            </div>
            <div>
              <label className="label">E-Mail *</label>
              <input {...register('email', { required: true })} type="email" className="input" placeholder="max@firma.de" />
            </div>
            <div>
              <label className="label">Passwort *</label>
              <input {...register('password', { required: true, minLength: 8 })} type="password" className="input" placeholder="mind. 8 Zeichen" />
            </div>
            <div>
              <label className="label">Rolle</label>
              <select {...register('role')} className="input">
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={createMutation.isLoading} className="btn-primary">
                {createMutation.isLoading ? 'Anlegen...' : 'Nutzer anlegen'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); reset(); }} className="btn-secondary">Abbrechen</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200/70 shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">E-Mail</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Rolle</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Letzter Login</th>
                  <th className="px-4 py-3 w-48"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className="badge bg-gray-100 text-gray-700">{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`badge ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.isActive ? 'Aktiv' : 'Deaktiviert'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString('de-DE') : '–'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => setResetPwUser({ id: u._id, name: u.name })}
                          className="text-xs border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg px-2.5 py-1 transition-colors whitespace-nowrap"
                          title="Passwort zurücksetzen"
                        >
                          Passwort
                        </button>
                        {u._id !== currentUser?._id && (
                          <button
                            onClick={() => setConfirmDelete({ id: u._id, name: u.name })}
                            className="text-xs border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2.5 py-1 transition-colors whitespace-nowrap"
                          >
                            Löschen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Passwort-Reset-Modal */}
      {resetPwUser && (
        <ResetPasswordModal user={resetPwUser} onClose={() => setResetPwUser(null)} />
      )}

      {/* Löschen-Bestätigungsdialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6">
            <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 text-center mb-1">Nutzer löschen?</h3>
            <p className="text-sm text-slate-600 text-center mb-5">
              <span className="font-semibold">"{confirmDelete.name}"</span> wird unwiderruflich gelöscht.
            </p>
            {deleteMutation.isError && (
              <p className="text-xs text-red-600 text-center mb-3">
                {(deleteMutation.error as any)?.response?.data?.message || 'Fehler beim Löschen'}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Abbrechen</button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isLoading}
                className="btn-danger flex-1"
              >
                {deleteMutation.isLoading ? 'Löschen…' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
