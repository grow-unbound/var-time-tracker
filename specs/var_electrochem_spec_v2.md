# VAR Electrochem — Labor Tracker v2 Spec
### Features: Competency Matrix · Project Planning · Production Planning
**v2.0 — April 2025 · Confidential**

---

## 0. Schema Changes (Delta from v1)

These tables are missing from the current schema and must be added before any v2 feature is built. All existing tables remain unchanged.

### 0.1 New Tables

#### sub_projects
One SubProject is auto-created per Department when a Project is created.

| Column | Type | Constraint |
|---|---|---|
| sub_project_id | INTEGER PK | Auto-increment |
| project_id | INTEGER FK | → projects. NOT NULL |
| dept_id | INTEGER FK | → departments. NOT NULL |
| name | TEXT | Auto-generated: "{project_name} — {dept_name}" |
| status | TEXT | CHECK IN ('not_started','in_progress','completed','on_hold'). Default: 'not_started' |
| planned_start | DATE | Nullable |
| planned_end | DATE | Nullable |
| actual_start | DATE | Nullable |
| actual_end | DATE | Nullable |
| predecessor_sub_project_id | INTEGER FK | → sub_projects. Nullable. Finish-to-start dependency only |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| created_by | UUID FK | → employees. NOT NULL |
| updated_by | UUID FK | → employees. NOT NULL|

> UNIQUE constraint on (project_id, dept_id) — one SubProject per Project-Department pair.

#### employee_competencies
Maps Workers to Activities with competency level and validity dates.

| Column | Type | Constraint |
|---|---|---|
| competency_id | INTEGER PK | Auto-increment |
| emp_id | UUID FK | → employees. NOT NULL |
| activity_id | INTEGER FK | → activities. NOT NULL |
| level | INTEGER | CHECK IN (0, 1). 0 = Not Qualified, 2 = Qualified. Default: NULL indicating unknown competency |
| active_date | DATE | NOT NULL. Date qualification was granted |
| expiry_date | DATE | Nullable. NULL = does not expire |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| created_by | UUID FK | → employees. NOT NULL |
| updated_by | UUID FK | → employees. NOT NULL|

> UNIQUE constraint on (emp_id, activity_id) — one competency record per Worker-Activity pair.

#### shift_assignments
Planned assignment of a Worker to a Project-Department during a Shift.

| Column | Type | Constraint |
|---|---|---|
| assignment_id | INTEGER PK | Auto-increment |
| emp_id | UUID FK | → employees. NOT NULL |
| sub_project_id | INTEGER FK | → sub_projects. NOT NULL |
| activity_id | INTEGER FK | → activities. NOT NULL |
| shift_date | DATE | NOT NULL |
| shift_id | UUID FK | → shifts. NOT NULL |
| duration | DECIMAL | in hours NOT NULL e.g. 3.25 hours i.e. 3 hours 15 minutes, not more than 8 hours |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| created_by | UUID FK | → employees. NOT NULL |
| updated_by | UUID FK | → employees. NOT NULL|

> No UNIQUE constraint — same employee can appear in multiple cells (different SubProject+Activity combos per shift). Application enforces 8hr cap validation.

#### milestones
Planned assignment of a Worker to a Project-Department during a Shift.

| Column | Type | Constraint |
|---|---|---|
| milestone_id | INTEGER PK | AUTO-INCREMENT |
| name | TEXT | NOT NULL |
| target_date | DATE | NOT NULL |
| project_id | INTEGER | FK → projects (nullable — project-level milestone) |
| sub_project_id | INTEGER | FK → sub_projects (nullable — subproject-level milestone) |
| status | TEXT | CHECK IN ('pending','achieved','missed') |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| created_by | UUID FK | → employees. NOT NULL |
| updated_by | UUID FK | → employees. NOT NULL|

> Must have either project_id or sub_project_id — not both, not neither (enforced at app layer)
> Rendered as a ◆ diamond on the timeline at target_date on the corresponding project or subproject row
> A project-level milestone sits on the parent project row spanning all subproject rows visually
> Status auto-computes: if target_date < today and status = 'pending' → show as missed (red ◆)

### 0.2 Schema Changes to Existing Tables

#### projects — add columns
```sql
ALTER TABLE projects ADD COLUMN planned_start DATE;
ALTER TABLE projects ADD COLUMN planned_end DATE;
ALTER TABLE projects ADD COLUMN actual_start DATE;
ALTER TABLE projects ADD COLUMN actul_end DATE;
ALTER TABLE projects ADD COLUMN description TEXT;
```

#### employees — add column
```sql
ALTER TABLE employees ADD COLUMN is_active BOOLEAN DEFAULT true;
```

### 0.3 Auto-generation Logic for SubProjects

When a new Project is created (via admin or API), automatically insert one SubProject row for each active Department. 
This runs as a Prisma transaction:

```
POST /api/projects → creates project → 
  for each dept in departments.findMany({ where: { is_active: true }})
    creates sub_project { project_id, dept_id, name: `${project.name} — ${dept.name}` }
```

### 0.3 Load data for existing tables and new tables based on the above schema
- Add sub_projects for existing Projects and Departments
- Add random employee competencies across different Projects and Departments. Ensure that there are at least 4 Employees with <3 Activities and at least 6 Activties with <3 Employees. Also add active_date and expiry_date for competency level assigments. Generally add 1 year validity. Ensure to have some Workers already wtih expired adn expiry_date in next 30 days.
- Add historical Employee Assignments for the last 10 days for Employee - Sub Projects and Activities (only for skills they have) #Employees per Activity in each Project/Department distributed by total #Employees/Department today.
- Add a few past and future milestones per subproject and project considering today's date

---

## 1. Competency Matrix

### 1.1 Purpose
Shows which Workers are qualified for which Activities across all Departments. Primary use: understand cross-department skills, spot expiring qualifications, identify coverage gaps.

### 1.2 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Page Title Row                                                 │
├─────────────────────────────────────────────────────────────────┤
│  FILTERS: Search (worker name) | Dept filter | Activity filter  │
│           Competency status: All | Active | Expired | Expiring  │
├─────────────────────────────────────────────────────────────────┤
│  KPI CARDS ROW                                                  │
│  [Activities <3 workers] [Workers <3 activities]                │
│  [Expired competencies] [Expiring in 30 days]                   │
├─────────────────────────────────────────────────────────────────┤
│              │  ←——— ACTIVITIES (columns) ———→                  │
│              │  [Grouped by Department header spanning columns] │
│  WORKERS     │  Act1 Act2 Act3 | Act4 Act5 | Act6 Act7 Act8     │
│  (rows,      ├──────┬─────────────────────────────────────────  │
│  paginated   │ Emp1 │  ●1  │     │  ●0  │     │  ●1  │          │
│  25/page)    │ Emp2 │      │  ●1 │      │  ●1 │      │  ●0      │
│              │ Emp3 │  ●0  │  ●0 │      │     │      │          │
└──────────────┴──────────────────────────────────────────────────┘
```

### 1.3 Matrix Cell Rendering

| State | Visual |
|---|---|
| Not qualified | Empty cell, white background |
| Level 0 — Not Qualified | ✗ on light navy background (#E8EFF7) |
| Level 1 — Qualified | ✓ on navy background (#1B3A5C), white text |
| Expired | ! on light red background (#FDECEA) |
| Expiring ≤30 days | ✓! on amber background (#FDF3E0) with tooltip showing expiry date |

> The checkmark conveys qualification. The background colour conveys level and status. Both signals are explicit — no colour-only encoding.
> Add Legend showing the menaing of each color code and cell on the top right of the table

### 1.4 Column Grouping

Activities are grouped by Department with a spanning header row:

```
| ←—— PRODUCTION (14) ——→ | ←— QUALITY (8) —→ | ←— DESIGN (9) —→ |
| Pellet | Stack | Wrap... | Inward | Process... | Design | Draw... |
```

This makes cross-department skills immediately visible — a worker with cells lit in multiple department groups is visibly cross-skilled.

### 1.5 KPI Cards

| KPI | Calculation | Alert threshold |
|---|---|---|
| Activities with < 3 qualified workers | COUNT activities WHERE qualified_workers < 3 | Any > 0 → amber card |
| Workers with < 3 activities | COUNT employees WHERE qualified_activities < 3 | Context only, no alert |
| Expired competencies | COUNT where expiry_date < today | Any > 0 → red card |
| Expiring in 30 days | COUNT where expiry_date BETWEEN today AND today+30 | Any > 0 → amber card |

> Ensure that only Workers with Competency level = 1 and Active (not expired competency status) are considered for Qualified Workers

### 1.6 Pagination
- Default: 25 workers per page
- Sorted by Department then last_name alphabetically
- Search filters workers in real-time client-side (already loaded page)
- Department filter resets to page 1

### 1.7 API Routes

```
GET  /api/competencies/matrix
     → returns { workers[], activities[], competencies[], departments[] }
     → workers paginated: ?page=1&limit=25
     → filters: ?dept=PROD&activity=5&status=expiring

GET  /api/competencies/kpis
     → returns { lowCoverageActivities, lowSkillWorkers, expired, expiringSoon }

POST /api/competencies
     → body: { emp_id, activity_id, level, active_date, expiry_date }
     → upserts — if record exists for (emp_id, activity_id), updates it

DELETE /api/competencies/:competency_id
     → soft delete: set expiry_date = today
```

### 1.8 Inline Editing
Clicking a cell opens a small popover (not a full modal):
- Level toggle: Not Qualified | Qualified
- Active date picker
- Expiry date picker (optional)
- Save / Remove buttons
- No full-page navigation

---

## 2. Project Planning (Gantt Timeline)

### 2.1 Purpose
Shows all Projects and their SubProjects on a timeline. Planned dates vs actual hours logged. Simple dependency arrows. Milestone markers. Click to edit.

### 2.2 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  VIEW: Week | Month    RANGE: ← Apr 2025 →    + New Project      │
├─────────────────────┬────────────────────────────────────────────┤
│  PROJECT / SUBPROJ  │  T I M E L I N E   A X I S                 │
│                     │  W1    W2    W3    W4  | W1    W2    W3    │
├─────────────────────┼────────────────────────────────────────────┤
│ ▼ QRSAM        ●   │  [════════════════════════]                 │
│   └ Production  ↓  │     [══════]                                │
│   └ Quality     ↓  │           [══════════]                      │
│   └ Design      ↓  │  [════]                                     │
│   └ Sales           │  ◆ (milestone)                             │
├─────────────────────┼────────────────────────────────────────────┤
│ ▼ KONKURS           │        [═══════════════════]               │
│   └ Production      │              [═══════]                     │
└─────────────────────┴────────────────────────────────────────────┘
```

### 2.3 Timeline Axis

| View | Column width | Range |
|---|---|---|
| Week view | 1 column = 1 week | T-4 weeks to T+8 weeks (13 columns) |
| Month view | 1 column = 1 month | T-1 month to T+4 months (6 columns) |

Today is marked with a vertical red line across all rows.
Show week/month separators subty across all rows
Show horizontal separators across each Project to show clear cells (no need for sub_projects)

### 2.4 Bar Rendering

**Project bar (parent row):**
- Spans from earliest SubProject start to latest SubProject end
- Background: `--color-primary` navy, 8px height, rounded
- Not directly editable — derived from SubProject dates

**SubProject bar:**
- Background colour by status:
  - not_started → gray
  - in_progress → navy
  - completed → green
  - on_hold → amber
- Height: 20px, rounded
- Shows actual hours as a shaded overlay proportional to planned duration:
  - Overlay width = (actual_hours / planned_hours) × bar_width
  - Overlay colour: darker shade of bar colour at 40% opacity
  - Tooltip on hover: "Planned: Xh | Logged: Yh"

**Milestone marker:**
- Diamond shape (◆), `--color-accent` amber
- Sits on the planned_end date of the SubProject
- Tooltip shows SubProject name + date
- Click diamond opens a small modal to update the milestone
- Click on the bar where there is no milestone opens a small modal to create a new milestone (reuse modal)

### 2.5 Dependency Arrows
- Simple straight line with arrowhead from end of predecessor bar to start of successor bar (curved arrows, not straight)
- Line colour: `--color-border` gray
- Only finish-to-start dependencies
- No drag-to-create — dependencies set via edit modal only

### 2.6 Baseline vs Current — Simple Approach
Use `baseline_start` and `baseline_end` on SubProject (set once when project is first confirmed). Show as a thin gray ghost bar behind the current bar. Slip is visually obvious — if current bar extends beyond ghost bar, it's slipped.

```sql
ALTER TABLE sub_projects ADD COLUMN baseline_start DATE;
ALTER TABLE sub_projects ADD COLUMN baseline_end DATE;
```

When a SubProject's planned dates are first set and status moves from 'not_started' to 'in_progress', snapshot the dates into baseline fields. Never update baseline after that.

### 2.7 Edit Modal
Clicking any SubProject bar opens a modal:

| Field | Control |
|---|---|
| Status | Dropdown: not_started / in_progress / completed / on_hold |
| Planned start | Date picker |
| Planned end | Date picker |
| Is milestone | Toggle |
| Predecessor | Dropdown of other SubProjects in the same Project |
| Notes | Textarea (optional) |

Save → updates SubProject → timeline re-renders. No drag-to-resize in v1.

### 2.8 Contextual Alerts (shown as icons on rows)

| Alert | Condition | Icon |
|---|---|---|
| Overdue | planned_end < today AND status ≠ 'completed' | 🔴 red dot |
| Slipped | current planned_end > baseline_end | 🟡 amber dot |
| No dates set | planned_start IS NULL | ⚪ gray dot |
| On track | planned_end ≥ today AND status = 'in_progress' | 🟢 green dot |

### 2.9 API Routes

```
GET  /api/projects/timeline
     → returns projects with sub_projects, actual hours per sub_project
     → actual hours = SUM(duration_minutes) from time_entries 
       WHERE project_id matches, grouped by sub_project dept

GET  /api/projects/:id
     → single project with full sub_project details

PATCH /api/sub-projects/:id
     → body: { status, planned_start, planned_end, is_milestone, predecessor_sub_project_id }
     → if baseline_start IS NULL and planned_start is being set for first time:
       also sets baseline_start = planned_start, baseline_end = planned_end

POST /api/projects
     → creates project + auto-creates sub_projects for all active departments
```

---

## 3. Production Planning (Shift Board)

### 3.1 Purpose
Shows who is assigned to what during a specific date and shift. Two views: Matrix view (default, for shift supervisors) and Person view (for HR/managers). Read-only for now with add/remove assignment capability.

### 3.2 Filters (always visible, top of page)

| Filter | Control | Behaviour |
|---|---|---|
| Date | Date picker | Defaults to today |
| Shift | Toggle: 1st / 2nd / 3rd | Defaults to current shift based on time |
| Department | Multi-select | Filters rows in matrix view |
| Project | Multi-select | Filters columns in matrix view |
| Employee search | Text input | Highlights all cells containing that employee |

> Reuse the same filters panel and experience from the other pages - Dashboard and All Entries pages

### 3.3 View A — Matrix View (default)

**Rows:** Department → Activity (grouped, collapsible)
**Columns:** Projects (active only, filtered by selection)
**Cells:** Employee chips assigned to that Project + Activity combination in the selected shift

```
┌──────────────────────┬──────────────┬──────────────┬───────────┐
│ DEPT / ACTIVITY      │   QRSAM      │   KONKURS    │   BAH     │
├──────────────────────┼──────────────┼──────────────┼───────────┤
│ ▼ PRODUCTION         │              │              │           │
│   Stack Assembly     │ [RK] [SN]    │ [VR]         │           │
│   TIG Welding        │ [MG]         │ [MG] [RK]    │ [AN]      │
│   Pellet Mfg         │              │ [SR]         │ [SR]      │
├──────────────────────┼──────────────┼──────────────┼───────────┤
│ ▼ QUALITY            │              │              │           │
│   Process QC         │ [PD]         │              │ [PD]      │
│   Inward QC          │              │ [KI]         │           │
└──────────────────────┴──────────────┴──────────────┴───────────┘
```

**Employee chip:**
- Avatar circle (initials) + "<first_name> <last_name>"  format (Also show Xh as X hours in this work)
- Background: department colour (consistent across the app)
- If employee search is active: matching chips highlighted, non-matching dimmed

**Cell interactions:**
- Hover on any cell → show a button "Assign Employees" without disturbing layout
- Click Assign Employees → opens assign modal (select employee from qualified list only)
- Click existing chip → provide "X" button to open remove confirmation
- Employee appearing in multiple cells is allowed — shown identically in each cell
- Ensure employees order by first_name asc, last_name asc to ensure logical sequence of data

**Capacity indicator per employee:**
When employee search highlights one or more employees (based on query-text), highlight them across cells

### 3.4 View B — Person View

Activated by toggle: Matrix | Person

**Rows:** Employees (grouped by dept, filtered by dept filter)
**Columns:** Time slots — simplified as Activity blocks, not clock time

```
┌──────────────────┬───────────────────────────────────────────────┐
│ EMPLOYEE         │  ASSIGNMENTS THIS SHIFT                       │
├──────────────────┼───────────────────────────────────────────────┤
│ Rajesh Kumar     │ [QRSAM · Stack Assembly] [KONKURS · TIG Weld] │
│ Suresh Naidu     │ [BAH · Pellet Mfg]                            │
│ Anitha Reddy     │ [QRSAM · Process QC]     [BAH · Process QC]   │
│ Venkat Rao       │  — unassigned —                               │
└──────────────────┴───────────────────────────────────────────────┘
```

- Show summary of X hours of assignment for each Employee across all Assignments in this Shift (as a separate column next to the employee)
- Allow sort of the X hours column to allow for eash access to employees with few or no assignments
- Assignment chips show Project + Activity
- Unassigned employees shown explicitly — this is the operational alert
- Chips are colour-coded by Project (consistent project colour across the app)

### 3.5 Assign Modal

Opened by clicking an empty cell in Matrix view:

| Field | Control | Logic |
|---|---|---|
| Employee | Dropdown | Filtered to: correct department, has competency for this activity, not already in this cell |
| Activity | Pre-filled from row | Read-only in context |
| Project | Pre-filled from column | Read-only in context |
| #Hours | Hours/Min input | Hours as integers, Minutes as 15/30/45 minutes, Constrianed by total 8hrs 0min per Employee per Shift across all Assignments |
| Duration | Progress Bar | Show Employee's saved assignments and new addition visually distinct. like Duration field in Add Time Log Entry form |

> Only employees with a valid (non-expired) competency for the selected Activity appear in the dropdown. This is the skills-based assignment enforcement — not visible as a feature, just works.

### 3.6 Contextual Alerts

Shown as row/column headers or inline indicators:

| Alert | Where | Condition |
|---|---|---|
| Activity uncovered | Row header (Matrix view) | Cell is empty for an activity that has an active SubProject for that project |
| Employee unassigned | Person view | Employee has no assignments for this shift |
| No qualified worker available | Assign modal | Dropdown is empty after filtering by competency |
| Over-allocation warning | Tooltip on chip | Employee assigned to > 4 cells in the same shift (proxy for over-allocation without time tracking) |

### 3.7 API Routes

```
GET  /api/shift-board?date=&shift=&depts=&projects=
     → returns matrix data: { rows: [dept+activity], cols: [projects], assignments: [] }

GET  /api/shift-board/person-view?date=&shift=&depts=
     → returns { employees: [{ emp, assignments[], is_unassigned }] }

POST /api/shift-assignments
     → body: { emp_id, sub_project_id, activity_id, shift_date, shift }
     → validates: competency exists and not expired, not duplicate cell

DELETE /api/shift-assignments/:assignment_id
```

---

## 4. Shared Insight Alerts Summary

Alerts surface inline — no separate notifications screen in v1. Each context shows its own relevant alerts.

### Competency Matrix page
- Red KPI card: X competencies expired — workers cannot be legally assigned to these activities
- Amber KPI card: Y competencies expiring in 30 days — action required
- Amber KPI card: Z activities have fewer than 3 qualified workers — coverage risk
- Inline cell: expired cells shown in red — visible immediately on the matrix

### Project Planning page
- Red dot on row: SubProject overdue (past planned_end, not completed)
- Amber dot on row: SubProject slipped vs baseline
- Gray dot on row: SubProject has no dates set — planning incomplete
- Ghost bar behind current bar: slip magnitude visible at a glance

### Production Planning page
- Empty cell in Matrix view: activity uncovered for a project this shift
- Unassigned row in Person view: employee has no work assigned
- Empty dropdown in assign modal: no qualified worker available for this activity — skills gap surfaced at point of planning

---

## 5. Cursor Prompts (build order)

### Prompt 1 — Schema migration
```
Add the following to the Prisma schema per the v2 spec Section 0:
- sub_projects table with all columns and constraints
- employee_competencies table
- shift_assignments table
- milestones table
- Add planned_start, planned_end, description to projects
- Add baseline_start, baseline_end to sub_projects
- Add is_active to employees
- Add created_by, updated_by, udpated_at fields to all tables missing those values

Run prisma migrate dev --name v2_schema

Then add seed data for the new tables and additional columns:
- employee_competencies: assign 3-5 activities per production employee 
  from their department's activity list. Level 1 for most, Level 2 for 
  senior employees (PROD-001 to PROD-005). Set expiry_date to null for 
  most, expiry_date = today-10 for 2 records (expired), 
  expiry_date = today+20 for 3 records (expiring soon).
- sub_projects: auto-create for all existing projects × all departments. 
  Set planned_start and planned_end for QRSAM, BAH, KONKURS only. 
  Set baseline = planned for those. Set status = 'in_progress' for 
  Production and Quality subprojects of QRSAM.
- shift_assignments: seed 2025-04-16, 1st Shift. Assign 10-12 
  production employees across QRSAM and KONKURS projects, 
  across 3-4 activities each. Leave 2 employees unassigned.
```

### Prompt 2 — Competency Matrix page
```
Build /competency page using v2 spec Section 1.
Use existing design tokens from design_spec.md.
Matrix renders as an HTML table — not a chart library.
Columns grouped by department with spanning header.
Cell states: empty, level-0 (light navy + ✗), level-2 (dark navy + ✓), 
expired (red + !), expiring (amber + ✓).
KPI cards at top using existing metric card component pattern.
Legend showing lables for each of the cell states
Search bar for searching Employee Names
Pagination: 25 rows per page.
Clicking a cell opens an inline popover with level toggle + date fields.
POST /api/competencies on save.
```

### Prompt 3 — Project Planning (Gantt) page
```
Build /projects page using v2 spec Section 2.
Render timeline as a CSS grid — no external Gantt library.
Each row is a SubProject. Parent project row is a collapsible group header.
Bar position = (planned_start - range_start) / total_days × 100%
Bar width = (planned_end - planned_start) / total_days × 100%
Actual hours overlay as darker shade at proportional width.
Today line = fixed vertical red border at today's position.
Milestone = ◆ diamond positioned at planned_end.
Status dot alerts on row labels.
Search bar for searching projects and sub_projects
Click bar → modal with PATCH /api/sub-projects/:id.
Week/Month view toggle changes column headers and recalculates positions.
```

### Prompt 4 — Production Planning (Shift Board) page
```
Build /shift-board page using v2 spec Section 3.
Default view: Matrix (rows = dept+activity, columns = projects).
Person view toggle: rows = employees, chips = assignments.
Filters: date picker, shift toggle (1/2/3), dept multi-select, 
project multi-select, employee search text.
Employee chips: avatar circle (initials) + first name, dept colour.
Empty cell click → assign modal. Dropdown filtered by competency.
Chip click → remove confirmation.
Employee search: highlight matching chips, dim others.
Unassigned employees shown explicitly in Person view.
GET /api/shift-board for matrix data.
POST /api/shift-assignments to assign.
DELETE /api/shift-assignments/:id to remove.
```

---

# Project Color System — Spec Addition
**Addendum to v2 Spec · April 2025**

---

## Schema Change

```sql
ALTER TABLE projects ADD COLUMN color_key TEXT DEFAULT 'navy';
```

---

## Predefined Color Palette

Store the `color_key` in the DB. Render the hex in UI via a constants file.

| Key | Hex | Name |
|---|---|---|
| `navy` | `#1E3A5F` | Navy |
| `teal` | `#14B8A6` | Teal |
| `amber` | `#F59E0B` | Amber |
| `coral` | `#FB923C` | Coral |
| `violet` | `#A855F7` | Violet |
| `slate` | `#64748B` | Slate |
| `forest` | `#22C55E` | Forest |
| `rose` | `#F43F5E` | Rose |
| `ochre` | `#CA8A04` | Ochre |
| `indigo` | `#4F46E5` | Indigo |
| `pine` | `#15803D` | Pine |
| `sienna` | `#C2410C` | Sienna |

*Palette revised for maximal visual separation between keys (especially coral vs rose, teal vs pine). Hex values are defined only in `lib/constants.ts`.*

---

## Rules

- Color is selected when creating or editing a project — rendered as a row of filled circles, click to select, checkmark on active
- Default: first color not already used by an active project (app logic, not DB constraint)
- Color is used consistently everywhere that project appears:
  - Gantt bars (Project Planning)
  - Column headers (Shift Board matrix)
  - Assignment chips (Shift Board person view)
  - Chart segments (Dashboard)
- Store the mapping in a single `PROJECT_COLORS` constant in `lib/constants.ts`, imported wherever colors are needed — never hardcode hex values outside this file

---

## Constants File

```ts
// lib/constants.ts
export const PROJECT_COLORS: Record<string, { hex: string; name: string }> = {
  navy:   { hex: '#1E3A5F', name: 'Navy' },
  teal:   { hex: '#14B8A6', name: 'Teal' },
  amber:  { hex: '#F59E0B', name: 'Amber' },
  coral:  { hex: '#FB923C', name: 'Coral' },
  violet: { hex: '#A855F7', name: 'Violet' },
  slate:  { hex: '#64748B', name: 'Slate' },
  forest: { hex: '#22C55E', name: 'Forest' },
  rose:   { hex: '#F43F5E', name: 'Rose' },
  ochre:  { hex: '#CA8A04', name: 'Ochre' },
  indigo: { hex: '#4F46E5', name: 'Indigo' },
  pine:   { hex: '#15803D', name: 'Pine' },
  sienna: { hex: '#C2410C', name: 'Sienna' },
};

export const DEFAULT_PROJECT_COLOR = 'navy';

export function getProjectColor(key: string): string {
  return PROJECT_COLORS[key]?.hex ?? PROJECT_COLORS[navy].hex;
}
```

---

## Cursor Prompt

```
Add color_key TEXT column (default 'navy') to the projects table via 
a Prisma migration.

Create lib/constants.ts with a PROJECT_COLORS constant mapping 12 
color keys to hex values and display names as per the spec.

In the project create/edit modal, render color selection as a row of 
20px filled circles using the PROJECT_COLORS palette. Show a white 
checkmark on the selected circle. On project create, auto-select the 
first color_key not already used by an active project.

Pass color_key in all project API responses.

Apply project color consistently using getProjectColor(project.color_key):
- Gantt bars in /projects (Project Planning)
- Column headers in /shift-board matrix view
- Assignment chips in /shift-board person view
- Chart segment colors in the Dashboard
```

---

*VAR Electrochem Labor Tracker v2 Spec · April 2025 · Confidential*
