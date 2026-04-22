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

Toolbar uses a **three-column layout** on medium+ viewports (aligned with Project Planning): **left** — Matrix | Person toggle + search; **center** — date picker + shift toggle (1st / 2nd / 3rd); **right** — Department multi-select, Project multi-select, **Clear** (clears only department/project selections, not search).

| Filter | Control | Behaviour |
|---|---|---|
| Date | Date picker | Defaults to today |
| Shift | Toggle: 1st / 2nd / 3rd | Defaults to current shift based on time |
| Department | Multi-select | Filters matrix rows and person-view employees |
| Project | Multi-select | Filters matrix columns; also drives **person-view project columns** (same active-project set as matrix) |
| Search | Text input | **Matrix view:** filters **rows** by department name or activity name (case-insensitive). **Person view:** filters **employees** by first name, last name, or full name. Empty search shows all. |

> Page shell matches Project Planning: main content lives in a card section (`rounded-card`, kicker + title on the route, body spacing `space-y-4`). Reuse multi-select patterns from Dashboard / All Entries where applicable.

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
- Avatar circle (initials) + short label (e.g. first name + hours) in cell
- Background: department colour (consistent across the app)

**Layout & scroll:**
- Matrix body uses the same pattern as Project Planning: outer `overflow-x-auto`, inner **flex** with a **sticky left column** (~260px) for “Dept / Activity” and row labels; the **project grid scrolls horizontally** so department/activity labels do not move with the scroll.

**Cell interactions:**
- **Empty cell** (sub-project exists for that project × activity, no assignments yet): **click the cell** → opens assign modal (select employee from qualified list only).
- **Existing chip:** **click** → opens **edit** modal (adjust hours; **Remove** deletes the assignment). No separate remove-confirmation dialog for chip-only flow.
- Employee appearing in multiple cells is allowed — shown identically in each cell.
- Chips ordered by first name, then last name.

**Search:** filters which **activity rows** appear (department or activity name match); it does not dim individual chips.

### 3.4 View B — Person View

Activated by toggle: Matrix | Person

**Rows:** Employees (grouped by department, filtered by department filter and by **search** on employee name).

**Columns:** **Employee** | **Assigned hours** (total hours this shift) | **one column per project** (same `cols` as matrix for the current date/shift/dept/project filters). Each project cell contains **chips** for assignments in that project only; each chip shows **activity name + duration**. Empty project cell is **clickable** to add an assignment (modal: pick activity for that employee × project, then hours).

**Layout:** Horizontal scroll with **sticky white** left block for Employee + Assigned hours (fixed widths, shadow/border like other matrices); project headers use project colour accents.

**Sorting:** **Inline sort** on column headers **Employee** and **Assigned hours** (toggle asc/desc); no separate “Sort by” dropdown.

```
┌──────────────┬────────┬──────────┬──────────┬──────────┐
│ EMPLOYEE     │ ASSIGNED HRS │ QRSAM    │ KONKURS  │ BAH      │
├──────────────┼────────┼──────────┼──────────┼──────────┤
│ PRODUCTION   │        │          │          │          │
│ Rajesh Kumar │ 6.5h   │ [Stack..]│ [TIG..]  │          │
│ Venkat Rao   │ —      │          │          │          │
└──────────────┴────────┴──────────┴──────────┴──────────┘
```

- **Assigned hours** column: sum of all assignments for that shift; show **—** when unassigned (no hours).
- Unassigned employees remain visible — operational signal that they have no work this shift.
- Chips in project columns are colour-coded by project (same `color_key` / constants as elsewhere).

**Data loading:** The UI loads **matrix** `GET /api/shift-board` whenever filters/date/shift change (even in Person view) so assign-modal qualification / activity options stay consistent with matrix filters.

### 3.5 Assign Modal

**Matrix — empty cell:** click cell → **Create** modal. Activity and project (and sub-project) are fixed from the cell context.

**Matrix — chip:** click chip → **Edit** modal: employee and activity implied by the assignment; adjust **hours/minutes**; **Save** (`PATCH`) or **Remove** (`DELETE`).

**Person — empty project cell:** click → **Create** modal: employee and project fixed; user picks **Activity** from activities that have a sub-project for that project in the employee’s department (options derived from loaded matrix payload). Then hours/minutes; **Save** (`POST`).

**Person — chip:** click → **Edit** modal: same as matrix edit (duration + remove).

| Context | Field | Control | Logic |
|---|---|---|---|
| Matrix create | Employee | Dropdown | Qualified for activity, same dept as activity row, not already in this cell |
| Matrix create | Activity / Project | (context) | Fixed from cell |
| Person create | Activity | Dropdown | Valid (project × dept) pairs from matrix `rows` / `cells` |
| Person create | Employee | (context) | Fixed from row |
| All creates | Hours / Minutes | Selects | 0–8h integer + 0/15/30/45 min; total per employee per shift ≤ 8h |
| Edit | Hours / Minutes | Selects | Same quarter-hour rules; total ≤ 8h excluding the row being edited |
| All | Load bar | Progress | Existing vs new/edited duration where applicable |

> Only employees with a valid (non-expired) competency for the selected Activity appear where a dropdown is used. **PATCH** `/api/shift-assignments/:id` updates `duration_hours` only, with the same cap logic as create.

### 3.6 Contextual Alerts

Shown as row/column headers or inline indicators:

| Alert | Where | Condition |
|---|---|---|
| Activity uncovered | Matrix (optional / future) | Cell is empty for an activity that has an active SubProject for that project — **no persistent “Uncovered” label in-cell** in current UI; supervisors infer from empty cells |
| Employee unassigned | Person view | Employee has no assignments for this shift |
| No qualified worker available | Assign modal | Dropdown is empty after filtering by competency |
| Over-allocation warning | Tooltip on chip | Employee assigned to > 4 cells in the same shift (proxy for over-allocation without time tracking) |

### 3.7 API Routes

```
GET  /api/shift-board?date=YYYY-MM-DD&shift=<id>&depts=<comma ids>&projects=<comma ids>
     → returns matrix data:
        { rows: [...], cols: [...projects...], cells: [...], assignments: [...],
          qualifications: [...], shiftDate, shiftId }

GET  /api/shift-board/person-view?date=YYYY-MM-DD&shift=<id>&depts=<comma ids>&projects=<comma ids>
     → `depts` and `projects` optional; same project filter semantics as matrix for **cols**
     → returns:
        { employees: [{ empId, name fields, departmentId, departmentName, totalHours,
                         isUnassigned, assignments: [...] }],
          cols: [{ projectId, projectCode, projectName, colorKey }],  // same shape as matrix cols
          shiftDate, shiftId }

POST /api/shift-assignments
     → body: { emp_id, sub_project_id, activity_id, shift_date, shift_id, duration_hours }
     → validates: competency exists and not expired, not duplicate cell, ≤8h total per emp/shift

PATCH /api/shift-assignments/:assignment_id
     → body: { duration_hours } (quarter-hour steps, same as POST)
     → validates: assignment exists; new total per emp/shift ≤ 8h

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
Page shell: same card section pattern as /projects (kicker + title + body).
Toolbar: 3-column grid — (toggle + search) | (date + shift) | (dept + project + Clear).
Default view: Matrix (rows = dept+activity, columns = projects).
Matrix: flex + sticky left label column; horizontal scroll on project grid only.
Person view: rows = employees; columns = Employee, Assigned hours, then one column per project (cols from API).
Search: matrix = filter rows by dept/activity name; person = filter employees by name.
Employee chips (matrix): initials + short label, dept colour.
Empty matrix cell (assignable) → create assign modal. Chip → edit modal (hours + remove).
Empty person project cell → create modal with activity dropdown. Chip → edit modal.
Always fetch GET /api/shift-board when filters change (including in Person view) for modal/board consistency.
GET /api/shift-board/person-view with same depts+projects query params; response includes cols.
POST /api/shift-assignments to assign. PATCH /api/shift-assignments/:id for duration. DELETE to remove.
Person: inline sort on Employee + Assigned hours headers; sticky white label columns.
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
  - Column headers and assignment chips (Shift Board person view — per-project columns)
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
- Column headers and assignment chips in /shift-board person view (project columns)
- Chart segment colors in the Dashboard
```

---

*VAR Electrochem Labor Tracker v2 Spec · April 2025 · Confidential*
