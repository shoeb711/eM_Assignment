import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Button } from '../components/ui.jsx';
import { TextInput } from '../components/form.jsx';

// Demo accounts shown on the login page for the interview (password for all: Demo@123)
const DEMO_USERS = [
  { email: 'layla.haddad@demo.local', role: 'Administrator' },
  { email: 'priya.nair@demo.local', role: 'Project Manager' },
  { email: 'daniel.brooks@demo.local', role: 'Project Manager' },
  { email: 'chen.wei@demo.local', role: 'Contributor' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/dashboard'} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">PMO Portfolio Portal</h1>
          <p className="mb-5 text-sm text-slate-500">Sign in to continue</p>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <TextInput id="email" label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextInput id="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            <Button type="submit" className="w-full" loading={submitting}>Sign in</Button>
          </form>
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/60 p-4 text-xs text-slate-600">
          <p className="mb-2 font-medium">Demo accounts (password <code>Demo@123</code>)</p>
          <ul className="space-y-1">
            {DEMO_USERS.map((u) => (
              <li key={u.email}>
                <button type="button" className="text-indigo-700 hover:underline" onClick={() => { setEmail(u.email); setPassword('Demo@123'); }}>
                  {u.email}
                </button>{' '}— {u.role}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
