// Phase 0 placeholder screen: proves React -> Express API -> PostgreSQL are all connected.
import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState({ state: 'loading' });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth({ state: data.status === 'ok' ? 'ok' : 'error', data }))
      .catch(() => setHealth({ state: 'error', data: { message: 'API is not running' } }));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-md w-full">
        <h1 className="text-2xl font-semibold text-slate-900">eMinds Assignment</h1>
        <p className="text-slate-500 mt-1">Project Portfolio &amp; Financial Control Portal</p>

        <div className="mt-6 text-sm">
          {health.state === 'loading' && <p className="text-slate-500">Checking API…</p>}
          {health.state === 'ok' && (
            <p className="text-emerald-700 font-medium">API connected ✓ · Database connected ✓</p>
          )}
          {health.state === 'error' && (
            <p className="text-red-700 font-medium">
              Connection problem: {health.data?.message || health.data?.database}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
