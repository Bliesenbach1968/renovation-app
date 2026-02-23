import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getProject, getProjectTimeline, updateProject } from '../api/projects';
import { useState } from 'react';

const PHASE_NAMES: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten',
};

function formatDate(d?: string) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function DelayBadge({ days, percent }: { days: number; percent: number }) {
  if (days === 0) return <span className="badge bg-green-100 text-green-700">✓ Im Plan</span>;
  if (days <= 7)  return <span className="badge bg-yellow-100 text-yellow-700">+{days} Tage ({percent}%)</span>;
  return <span className="badge bg-red-100 text-red-700">+{Math.ceil(days / 7)} Wochen ({percent}%)</span>;
}

export default function TimelinePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [timelineForm, setTimelineForm] = useState({ plannedStart: '', plannedEnd: '', actualStart: '', actualEnd: '' });

  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!), {
    onSuccess: (p) => {
      if (!editing) setTimelineForm({
        plannedStart: p.timeline?.plannedStart?.slice(0, 10) || '',
        plannedEnd:   p.timeline?.plannedEnd?.slice(0, 10)   || '',
        actualStart:  p.timeline?.actualStart?.slice(0, 10)  || '',
        actualEnd:    p.timeline?.actualEnd?.slice(0, 10)    || '',
      });
    },
  });
  const { data: timeline } = useQuery(['timeline', projectId], () => getProjectTimeline(projectId!));

  const saveMutation = useMutation(
    () => updateProject(projectId!, { timeline: timelineForm as any }),
    { onSuccess: () => { qc.invalidateQueries(['project', projectId]); qc.invalidateQueries(['timeline', projectId]); setEditing(false); } }
  );

  const pt = timeline?.projectTimeline;
  const pd = timeline?.projectDelay;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-2xl font-bold text-gray-900">Zeitplan</h1>
        <span className="text-gray-400 text-sm">{project?.name}</span>
      </div>

      {/* Gesamtprojekt-Zeitplan */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Gesamtprojekt</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">Bearbeiten</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading} className="btn-primary btn-sm">Speichern</button>
              <button onClick={() => setEditing(false)} className="btn-secondary btn-sm">Abbrechen</button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'plannedStart', label: 'Geplanter Start' },
              { key: 'plannedEnd',   label: 'Geplantes Ende' },
              { key: 'actualStart',  label: 'Tatsächlicher Start' },
              { key: 'actualEnd',    label: 'Tatsächliches Ende' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="date" value={(timelineForm as any)[key]}
                  onChange={(e) => setTimelineForm(f => ({ ...f, [key]: e.target.value }))} className="input" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-gray-400 text-xs mb-1">Geplanter Start</p><p className="font-medium">{formatDate(pt?.plannedStart)}</p></div>
            <div><p className="text-gray-400 text-xs mb-1">Geplantes Ende</p><p className="font-medium">{formatDate(pt?.plannedEnd)}</p></div>
            <div><p className="text-gray-400 text-xs mb-1">Tatsächlicher Start</p><p className="font-medium">{formatDate(pt?.actualStart)}</p></div>
            <div><p className="text-gray-400 text-xs mb-1">Tatsächliches Ende</p><p className="font-medium">{formatDate(pt?.actualEnd)}</p></div>
          </div>
        )}

        {pd && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
            <span className="text-sm text-gray-600">Gesamtverzögerung:</span>
            <DelayBadge days={pd.days} percent={pd.percent} />
            {pd.days > 0 && <span className="text-xs text-gray-400">({pd.weeks} Wochen, {pd.percent}% der Laufzeit)</span>}
          </div>
        )}
      </div>

      {/* Phasen-Zeitplan */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Phasenzeitplan</h2>
        <div className="space-y-4">
          {timeline?.phases?.map((phase: any) => (
            <div key={phase.phaseType} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{phase.phaseName}</h3>
                <DelayBadge days={phase.delay.days} percent={phase.delay.percent} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><p className="text-gray-400 text-xs mb-0.5">Plan-Start</p><p>{formatDate(phase.planned.start)}</p></div>
                <div><p className="text-gray-400 text-xs mb-0.5">Plan-Ende</p><p>{formatDate(phase.planned.end)}</p></div>
                <div><p className="text-gray-400 text-xs mb-0.5">Ist-Start</p><p>{formatDate(phase.actual.start)}</p></div>
                <div><p className="text-gray-400 text-xs mb-0.5">Ist-Ende</p><p>{formatDate(phase.actual.end)}</p></div>
              </div>
              {phase.delay.days > 0 && (
                <div className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
                  Verzögerung: {phase.delay.days} Tage ({phase.delay.weeks} Wochen / {phase.delay.percent}%)
                </div>
              )}
            </div>
          ))}
          {(!timeline?.phases || timeline.phases.length === 0) && (
            <p className="text-gray-400 text-sm text-center py-4">Noch keine Zeitplandaten erfasst</p>
          )}
        </div>
      </div>
    </div>
  );
}
