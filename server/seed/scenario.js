// The fixed "story" behind the generated data. All names, projects and amounts are FICTIONAL.
// Each project is set up to demonstrate a specific situation the assignment asks for (Section 6).

export const REPORTING_DATE = '2026-09-30'; // baseline snapshot date for all KPIs
export const RANDOM_SEED = 20260930;        // same seed => same data every time
export const DEMO_PASSWORD = 'Demo@123';     // password for every demo user

export const departments = [
  { id: 1, name: 'Digital Channels' },
  { id: 2, name: 'Enterprise IT' },
  { id: 3, name: 'Network Operations' },
];

// 16 users: 1 admin, 5 project managers, 10 contributors
export const users = [
  { id: 1, name: 'Layla Haddad', role: 'ADMIN', dept: 2 },
  { id: 2, name: 'Omar Farouk', role: 'PROJECT_MANAGER', dept: 1 },
  { id: 3, name: 'Priya Nair', role: 'PROJECT_MANAGER', dept: 2 },
  { id: 4, name: 'Daniel Brooks', role: 'PROJECT_MANAGER', dept: 3 },
  { id: 5, name: 'Mariam Saleh', role: 'PROJECT_MANAGER', dept: 1 },
  { id: 6, name: 'Arjun Mehta', role: 'PROJECT_MANAGER', dept: 2 },
  { id: 7, name: 'Aisha Khan', role: 'CONTRIBUTOR', dept: 1 },
  { id: 8, name: 'Ravi Kumar', role: 'CONTRIBUTOR', dept: 1 },
  { id: 9, name: 'Fatima Ali', role: 'CONTRIBUTOR', dept: 1 },
  { id: 10, name: 'Chen Wei', role: 'CONTRIBUTOR', dept: 2 },
  { id: 11, name: 'Noura Rashid', role: 'CONTRIBUTOR', dept: 2 },
  { id: 12, name: 'Thomas Reid', role: 'CONTRIBUTOR', dept: 2 },
  { id: 13, name: 'Hassan Youssef', role: 'CONTRIBUTOR', dept: 3 },
  { id: 14, name: 'Elena Petrova', role: 'CONTRIBUTOR', dept: 3 },
  { id: 15, name: 'Karim Mansour', role: 'CONTRIBUTOR', dept: 3 },
  { id: 16, name: 'Sofia Martins', role: 'CONTRIBUTOR', dept: 1 },
];

export const costCategories = [
  { id: 1, name: 'Labour', weight: 45 },
  { id: 2, name: 'Software & Licences', weight: 20 },
  { id: 3, name: 'Hardware & Infrastructure', weight: 15 },
  { id: 4, name: 'External Services', weight: 15 },
  { id: 5, name: 'Training & Travel', weight: 5 },
];

// targetSpend  = posted spend up to the reporting date (as a share of the initial budget)
// forecastToComplete = planned spend after the reporting date (null = no forecast data)
export const projects = [
  {
    id: 1, code: 'PRJ-001', name: 'Customer Portal Revamp', dept: 1, owner: 2, status: 'ACTIVE',
    start: '2026-01-05', end: '2026-12-20', budget: 1200000, targetSpend: 0.55, forecastToComplete: 480000,
    members: [7, 8, 9, 16],
    story: 'Healthy project. Has a PENDING budget revision (must not count in the budget).',
  },
  {
    id: 2, code: 'PRJ-002', name: 'Billing Platform Migration', dept: 2, owner: 3, status: 'ACTIVE',
    start: '2025-11-01', end: '2027-02-28', budget: 2500000, targetSpend: 0.8, forecastToComplete: 1000000,
    members: [10, 11, 12],
    story: 'FORECAST TO EXCEED its approved budget (EAC > budget) even after an approved revision.',
  },
  {
    id: 3, code: 'PRJ-003', name: 'Data Lake Foundation', dept: 2, owner: 6, status: 'ACTIVE',
    start: '2026-02-01', end: '2026-11-30', budget: 900000, targetSpend: 0.93, forecastToComplete: 50000,
    members: [10, 11, 12],
    story: 'NEARING its budget (about 93% used).',
  },
  {
    id: 4, code: 'PRJ-004', name: 'Network Monitoring Upgrade', dept: 3, owner: 4, status: 'ACTIVE',
    start: '2026-08-01', end: '2027-03-31', budget: 650000, targetSpend: 0, forecastToComplete: 600000,
    members: [13, 14, 15],
    story: 'NO POSTED SPEND yet (only draft costs).',
  },
  {
    id: 5, code: 'PRJ-005', name: 'HR Self-Service App', dept: 2, owner: 3, status: 'COMPLETED',
    start: '2025-09-01', end: '2026-06-30', budget: 400000, targetSpend: 0.97, forecastToComplete: null,
    members: [11, 12],
    story: 'COMPLETED project. No forecast needed (nothing left to spend).',
  },
  {
    id: 6, code: 'PRJ-006', name: 'Field Service Mobile App', dept: 3, owner: 4, status: 'ACTIVE',
    start: '2026-03-01', end: '2027-01-31', budget: 750000, targetSpend: 0.45, forecastToComplete: 380000,
    members: [13, 14, 15, 16],
    story: 'Has a REJECTED budget revision and the UNASSIGNED task.',
  },
  {
    id: 7, code: 'PRJ-007', name: 'Cybersecurity Hardening', dept: 2, owner: 6, status: 'ON_HOLD',
    start: '2026-01-15', end: '2026-12-15', budget: 500000, targetSpend: 0.3, forecastToComplete: 220000,
    members: [10, 12],
    story: 'ON HOLD - several tasks are blocked.',
  },
  {
    id: 8, code: 'PRJ-008', name: 'Contact Centre AI Assistant', dept: 1, owner: 5, status: 'PLANNING',
    start: '2026-09-01', end: '2027-06-30', budget: 1100000, targetSpend: 0.03, forecastToComplete: null,
    members: [7, 9, 16],
    story: 'Active planning but NO FORECAST DATA yet (EAC falls back to actual spend and is flagged).',
  },
  {
    id: 9, code: 'PRJ-009', name: 'ERP Finance Upgrade', dept: 2, owner: 3, status: 'ACTIVE',
    start: '2025-10-01', end: '2026-12-31', budget: 1800000, targetSpend: 0.78, forecastToComplete: 450000,
    members: [10, 11],
    story: 'Has an APPROVED budget revision linked to an approved change request.',
  },
  {
    id: 10, code: 'PRJ-010', name: 'Branch Wi-Fi Rollout', dept: 3, owner: 4, status: 'ACTIVE',
    start: '2026-04-01', end: '2026-11-30', budget: 350000, targetSpend: 0.62, forecastToComplete: 160000,
    members: [13, 14, 15],
    story: 'Second project FORECAST TO OVERRUN.',
  },
];

// Task titles reused across projects (in delivery order).
export const taskTemplates = [
  'Requirements workshop',
  'Solution architecture design',
  'Environment and access setup',
  'Data model and API design',
  'Core build - sprint 1',
  'Core build - sprint 2',
  'Integration testing',
  'User acceptance testing',
  'Go-live and handover',
];

export const riskTemplates = [
  { type: 'RISK', title: 'Key vendor delivery delay', mitigation: 'Weekly vendor checkpoint and penalty clause' },
  { type: 'RISK', title: 'Insufficient test environment capacity', mitigation: 'Reserve cloud capacity in advance' },
  { type: 'RISK', title: 'Scope creep from business stakeholders', mitigation: 'Strict change-request process' },
  { type: 'ISSUE', title: 'Legacy data quality problems', mitigation: 'Data cleansing sprint before migration' },
  { type: 'RISK', title: 'Specialist resource availability', mitigation: 'Cross-train a second engineer' },
  { type: 'ISSUE', title: 'Security review findings outstanding', mitigation: 'Remediation plan with security team' },
  { type: 'RISK', title: 'Licence cost increase at renewal', mitigation: 'Negotiate multi-year pricing' },
  { type: 'ISSUE', title: 'Integration API instability', mitigation: 'Add retries and monitoring on the integration' },
];

export const changeRequestTemplates = [
  { title: 'Add data reconciliation module', cost: 150000, days: 30 },
  { title: 'Extend UAT by two weeks', cost: 25000, days: 14 },
  { title: 'Add Arabic language support', cost: 60000, days: 21 },
  { title: 'Switch to managed database service', cost: 40000, days: 0 },
  { title: 'Additional reporting dashboard', cost: 35000, days: 10 },
  { title: 'Defer mobile release to phase 2', cost: -50000, days: -20 },
  { title: 'Include single sign-on integration', cost: 45000, days: 12 },
  { title: 'Extra performance testing cycle', cost: 18000, days: 7 },
  { title: 'Upgrade hardware specification', cost: 70000, days: 5 },
];

export const costDescriptions = {
  1: ['Delivery team effort', 'Contract developer hours', 'Business analyst effort'],
  2: ['Platform subscription', 'Developer tool licences', 'Monitoring software licence'],
  3: ['Server and storage', 'Network equipment', 'Cloud infrastructure usage'],
  4: ['Consulting services', 'Penetration testing', 'Implementation partner fees'],
  5: ['User training sessions', 'Vendor workshop travel', 'Certification course'],
};
