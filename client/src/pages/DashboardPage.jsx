// Executive dashboard - built in Phase 4.
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui.jsx';

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Executive dashboard" subtitle="Portfolio KPIs, charts and drill-downs" />
      <Card>
        <p className="text-sm text-slate-600">The dashboard is coming in the next phase. Meanwhile, open <Link to="/projects" className="text-indigo-700 hover:underline">Projects</Link>.</p>
      </Card>
    </>
  );
}
