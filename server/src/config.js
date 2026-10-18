// All settings in one place, read from server/.env
import 'dotenv/config';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is missing - copy server/.env.example to server/.env');
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // All KPIs are calculated "as of" this date. The assignment fixes it at 30 Sep 2026 for the demo;
  // in production this would be today's date (or a date the user picks).
  reportingDate: process.env.REPORTING_DATE || '2026-09-30',

  // A risk/issue with probability x impact >= 15 (out of 25) is "high exposure".
  highRiskScore: 15,

  // How often the overdue-task automation runs automatically (0 = only manual "Run now").
  automationIntervalMinutes: Number(process.env.AUTOMATION_INTERVAL_MINUTES ?? 5),

  sessionCookieName: 'pmo_session',
  sessionHours: 8,
};
