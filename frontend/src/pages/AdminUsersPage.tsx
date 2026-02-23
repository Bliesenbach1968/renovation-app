import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { getUsers, registerUser } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator', projectLeader: 'Projektleiter', calculator: 'Kalkulator',
  worker: 'Ausführend', external: 'Extern (Lesend)',
};

export default function AdminUsersPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  if (!isAdmin) { navigate('/'); return null; }

  const { data: users = [], isLoading } = useQuery('users', getUsers);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { name: '', email: '', password: '', role: 'worker' },
  });

  const mutation = useMutation(registerUser, {
    onSuccess: () => { qc.invalidateQueries('users'); setShowForm(false); reset(); },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nutzerverwaltung</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Nutzer anlegen</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Neuen Nutzer anlegen</h2>
          {mutation.error != null && <div className="bg-red-50 text-red-700 text-sm border border-red-200 rounded px-3 py-2 mb-3">{(mutation.error as any).response?.data?.message}</div>}
          <form onSubmit={handleSubmit((data) => mutation.mutate(data as any))} className="grid grid-cols-2 gap-4">
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
              <button type="submit" disabled={mutation.isLoading} className="btn-primary">{mutation.isLoading ? 'Anlegen...' : 'Nutzer anlegen'}</button>
              <button type="button" onClick={() => { setShowForm(false); reset(); }} className="btn-secondary">Abbrechen</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-cell text-left font-medium text-gray-600">Name</th>
                <th className="table-cell text-left font-medium text-gray-600">E-Mail</th>
                <th className="table-cell text-left font-medium text-gray-600">Rolle</th>
                <th className="table-cell text-left font-medium text-gray-600">Status</th>
                <th className="table-cell text-left font-medium text-gray-600">Letzter Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{u.name}</td>
                  <td className="table-cell text-gray-500">{u.email}</td>
                  <td className="table-cell"><span className="badge bg-gray-100 text-gray-700">{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td className="table-cell">
                    <span className={`badge ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                  </td>
                  <td className="table-cell text-gray-400 text-xs">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('de-DE') : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
