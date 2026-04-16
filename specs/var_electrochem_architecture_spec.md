# VAR Electrochem — Labor Time Tracker
### Product Architecture & Feature Specification
**v1.0 — April 2025 · Confidential**

---

## Scope

**In scope (this document)**
- Time Entry Form — employee-facing, shift-based, multi-entry per day
- Management Dashboard — project/battery/department views with filters
- Data Model — full entity schema with constraints
- Tech Stack — on-premise Windows Server deployment
- Build Milestones — 6-week delivery plan

**Out of scope (v1)**
- Supervisor approval of time entries
- D365 / MS Dynamics integration (v2)
- MIS reports, BOM integration, profitability tracking (vendor scope)
- Login / authentication (v2 if required)

---

## 1. Entity Model

Seven core entities. Every time entry traces back to an employee, their department, the work done, the project, the battery model, and optionally the lot.

| Entity | Key Fields | Notes |
|---|---|---|
| Department | dept_id, dept_code, name | e.g. Production, Quality, R&D, Sales, Project Mgmt |
| Shift | shift_id, shift_name | e.g. 1st Shift, 2nd Shift, 3rd Shift |
| Employee | emp_id, emp_code, first_name, last_name, dept_id (FK), shift_id (FK) | Belongs to exactly one department |
| Activity | activity_id, name, dept_id (FK) | Department-specific. e.g. Quality → Inward QC, Outward QC, Testing |
| Project | project_id, name, project_code, description, status | Cross-department. Status: active / closed |
| Battery Model | battery_id, model_name, project_id (FK) | One project → many battery models |
| Lot | lot_id, lot_number, battery_id (FK), project_id (FK), quantity | Pre-defined per battery model. Employees select, never type |
| Time Entry | entry_id, emp_id, date, shift, activity_id, project_id, battery_id, lot_id, stage, duration_minutes | Core transactional record |

> **Activities are department-specific.** Quality has a different activity list than Production or R&D. Managed via admin panel.

> **Lots are pre-defined per Battery Model / Project.** Employees select from a dropdown — no free-text entry.

---

## 2. Time Entry Form

Employee-facing interface. Designed for desktop or tablet (Chrome, LAN-hosted). No login — department selection is the identity anchor.

### 2.1 Entry Flow

| Step | Field / Action | Control | Validation / Logic |
|---|---|---|---|
| 1 | Department | Dropdown | Required. Filters Employee list. |
| 2 | Employee | Dropdown | Filtered by Department. Shows EmpID + Full Name. |
| 3 | Date | Date picker | Defaults to today. Future dates blocked. |
| 4 | Shift | Toggle: 1st / 2nd / 3rd | Auto-locked if entries already exist for this emp + date. |
| 5 | Add Entry | Button → inline row | Multiple entries allowed per session. |
| 5a | Activity | Dropdown | Filtered by selected Department. |
| 5b | Project | Dropdown | All active projects. |
| 5c | Battery Model | Dropdown | Filtered by selected Project. |
| 5d | Stage | Toggle: R&D / Production | Controls whether Lot field appears. |
| 5e | Lot | Dropdown | Shown only when Stage = Production. Filtered by Battery Model. |
| 5f | Time Spent | 2 Dropdowns for Hours and Minutes | Hours Values: 1, 2 ... 8; Minutes Values: 15, 30, 45 min; Running total updates on change. |
| 6 | Running Total | Read-only counter | Shows X hrs Y min / 8 hrs. Turns danger -> success colors as the 8 hours as a gradient |
| 7 | Submit All | Button | Hard-blocked if total > 8hours or 480min. Saves all rows atomically. |

### 2.2 Business Rules

| Rule | Behaviour |
|---|---|
| Shift cap | Sum of all entries for (employee, date, shift) must not exceed 480 min. Submission hard-blocked if exceeded. |
| One shift per day | Allow to only add time for the shift the employee belongs to. |
| Minimum duration | Minimum block is 15 minutes. All values for minutes must be multiples of 15. |
| Multi-entry | Employee can add N entries per (date, shift). Each row = one (Activity, Project, Battery, Lot, Stage, Duration). |
| Dept-first flow | Select Department first → Employee list filters to that department only. |

### 2.3 UX Notes

- Running total shown as a progress bar: `X hrs Y min of 8 hrs updated`. Use design spec to show danger -> success state gradient as hrs are updated (less time tracked is danger vs full 8hrs updated is success).
- Entry rows added inline below the previous. No page reload.
- Submit button is disabled while total > 480 min or 8 hrs.
- On successful submit: show confirmation, clear entry rows, retain header fields (Dept, Employee, Date, Shift) for the next batch.
- Tablet layout: single-column stacked. Desktop: two-column grid for header fields, full-width for entry rows.
- Make the form look modern and not a standard data entry. Use a mix of dropdowns, upfront options visible, toggles, etc.

---

## 3. Management Dashboard

Primary view for Chairman, CFO, and HR. Opens directly on Project view. All data read-only.

### 3.1 Dashboard Specification

| Element | Description | Options / Values |
|---|---|---|
| Default View | Hours per Project, stacked by Battery Model | Loads on page open |
| View Toggle | Switch between Department and People view | Department \| People |
| Time Scope | Filter all data by period | Today \| Yesterday \| This Week \| This Month \| This Year |
| Filter: Dept | Narrow to one or more departments | Multi-select dropdown |
| Filter: Project | Narrow to specific project(s) | Multi-select dropdown |
| Filter: Battery | Narrow to specific battery model(s) | Multi-select dropdown |
| Stage Split | R&D vs Production shown as distinct segments in every chart | Always-on |
| Primary Chart | Stacked horizontal bar — X: Projects, Y: Hours, Segments: Battery Models | Darker shade = Production, lighter = R&D |
| Secondary Chart | Dept view: bar per dept \| People view: bar per employee | Switches with View Toggle |
| Metric Cards | Total Hours, Active Projects, Employees Logged, Entries Today | Top of dashboard |
| Data Freshness | "Last entry: X minutes ago" | Derived from latest entry timestamp |

### 3.2 Chart Behaviour

- **Primary chart:** Stacked horizontal bar. One bar per Project. Segments = Battery Models. Two shades per battery: darker = Production hours, lighter = R&D hours.
- **Department view:** Bar per department, same R&D/Production stage split.
- **People view:** Bar per employee who logged hours in selected period, same stage split.
- **Hover tooltip:** Shows Project / Battery / Stage / Hours.
- **Click to drill:** Clicking a project bar filters secondary chart to battery-level breakdown for that project. Breadcrumb to return to all-projects view.

> Chart.js runs fully offline via local bundle — no CDN calls in production.

---

## 4. Database Schema (SQLite → SQL Server ready)

Managed via Prisma ORM. Migrating to SQL Server later = change `DATABASE_URL` in `.env` and run `prisma migrate`. No code changes.

| Table | Column | Type | Constraint |
|---|---|---|---|
| departments | dept_id | INTEGER PK | Auto-increment |
| | dept_code | TEXT | NOT NULL, UNIQUE |
| | name | TEXT | NOT NULL, UNIQUE |
| shifts | shift_id | INTEGER PK | Auto-increment |
| | name | TEXT | NOT NULL, UNIQUE |
| employees | emp_id | TEXT PK | e.g. EMP001 |
| | emp_code | TEXT | NOT NULL, UNIQUE |
| | first_name, last_name | TEXT | NOT NULL |
| | dept_id | INTEGER FK | → departments NOT NULL|
| | shift_id | INTEGER FK | → shifts NOT NULL |
| activities | activity_id | INTEGER PK | Auto-increment |
| | name | TEXT | NOT NULL |
| | dept_id | INTEGER FK | → departments |
| projects | project_id | INTEGER PK | Auto-increment |
| | name | TEXT | NOT NULL |
| | project_code | TEXT | NOT NULL |
| | description | TEXT | |
| | status | TEXT | CHECK IN ('active','closed') |
| battery_models | battery_id | INTEGER PK | Auto-increment |
| | model_name | TEXT | NOT NULL |
| | project_id | INTEGER FK | → projects |
| lots | lot_id | INTEGER PK | Auto-increment |
| | lot_number | TEXT | NOT NULL |
| | battery_id | INTEGER FK | → battery_models |
| | project_id | INTEGER FK | → projects |
| | quantity | INTEGER | NOT NULL |
| time_entries | entry_id | INTEGER PK | Auto-increment |
| | emp_id | TEXT FK | → employees |
| | entry_date | DATE | NOT NULL, no future dates |
| | shift_id | INTEGER | CHECK IN (1,2,3) |
| | activity_id | INTEGER FK | → shifts |
| | project_id | INTEGER FK | → projects |
| | battery_id | INTEGER FK | → battery_models |
| | lot_id | INTEGER FK | Nullable (R&D entries) |
| | stage | TEXT | CHECK IN ('R&D','Production') |
| | duration_minutes | INTEGER | CHECK: multiple of 15, > 0 |
| | created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

> Store duration_minutes as time logged converted to minutes. However on the frontend, show values to the nearest hour and additional minutes. e.g. 150min ~ 2 hours, 30 minutes

---

## 5. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | Single deployable. API routes + UI in one process. No separate server. |
| Database | SQLite via Prisma ORM | Zero-config. Single file on disk. HR backs up by copying one file. SQL Server migration = config change only. |
| Auth | None (v1) | Dept + Employee selection is the identity mechanism. Add NextAuth in v2 if needed. |
| Charts | Chart.js (bundled locally) | Runs fully offline. No CDN dependency in production. |
| Styling | Tailwind CSS | No build complexity for deployment. Purged CSS in production. |
| Deployment | `node server.js` via `start.bat` | HR runs one file. No Docker, no cloud account, no IT ticket required. |

### Deployment for HR (install once)

```
1. Install Node.js (one-time, from USB or local network share)
2. Unzip app folder to C:\LaborTracker\
3. Double-click start.bat
4. Open Chrome → http://localhost:3000
```

---

## 6. Admin Panel (Reference Data Management)

The HR manages all reference data through a simple admin interface at `/admin`.

| Screen | Actions |
|---|---|
| Shifts | Add, edit, deactivate |
| Departments | Add, edit, deactivate |
| Employees | Add, edit, assign department and shift |
| Activities | Add per department, reorder, deactivate |
| Projects | Add, edit, mark as closed |
| Battery Models | Add per project |
| Lots | Add per battery model, set quantity |

> No deletion anywhere — only deactivation. Preserves historical integrity of time entries.

---

## 7. Build Milestones (6 Weeks)

| Milestone | Deliverable | Scope |
|---|---|---|
| M0 | Reference Data + DB Schema | Departments, Employees, Activities, Projects, Batteries, Lots seeded. Admin CRUD screens live. |
| M1 | Time Entry Form (complete) | Dept-first flow, shift lock, 8hr hard cap, multi-entry rows, all validations. |
| M2 | Dashboard v1 | Project view with Battery Model stacks, Stage split, metric cards, time scope filter. |
| M3 | Dashboard v2 + Filters | Dept/People view toggle, multi-select filters, drill-down click, data freshness indicator. |
| M4 | Polish + On-prem deploy | start.bat, install guide for HR, tablet responsiveness, edge case hardening. |
| M5 | Handoff + Admin guide | Admin panel complete, HR user guide document, handoff session. |

---

## 8. Open Decisions (to confirm before M0)

| # | Question | Impact | Answer |
|---|---|---|---|
| 1 | Will non-production staff (Sales, R&D) use the same form or a separate simplified form? | UX flow for M1 | No. Sales and R&D teams are out of scope for now |
| 2 | Should the admin panel be password-protected even if the main app has no auth? | M0 scope | Yes, keep admin, admin as username, password for admin panel |
| 3 | List of Departments, Activities per department, and initial Employees — who provides this? | M0 seed data — needed before dev starts | Use CRUD forms in admin panel for reference data |
| 4 | Should the dashboard be accessible from outside the LAN (e.g. Chairman viewing remotely)? | Deployment architecture | Not necessary. LAN only access with IP based url |
| 5 | Is there a need to export data (CSV / Excel) from the dashboard? | Could add to M4 | Out of scope |

---

*Prepared by Phani · April 2025*
