PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_projects" (
    "project_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "project_code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    CONSTRAINT "projects_status_check" CHECK ("status" IN ('active', 'closed'))
);

INSERT INTO "new_projects" ("description", "name", "project_code", "project_id", "status")
SELECT "description", "name", "project_code", "project_id", "status"
FROM "projects";

DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";

CREATE UNIQUE INDEX "projects_project_code_key" ON "projects"("project_code");

CREATE TABLE "new_time_entries" (
    "entry_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "emp_id" TEXT NOT NULL,
    "entry_date" DATETIME NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "battery_id" INTEGER NOT NULL,
    "lot_id" INTEGER,
    "stage" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "time_entries_stage_check" CHECK ("stage" IN ('R&D', 'Production')),
    CONSTRAINT "time_entries_duration_minutes_check" CHECK ("duration_minutes" > 0 AND "duration_minutes" % 15 = 0),
    CONSTRAINT "time_entries_emp_id_fkey" FOREIGN KEY ("emp_id") REFERENCES "employees" ("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("shift_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities" ("activity_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("project_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_battery_id_fkey" FOREIGN KEY ("battery_id") REFERENCES "battery_models" ("battery_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots" ("lot_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_time_entries" (
    "activity_id",
    "battery_id",
    "created_at",
    "duration_minutes",
    "emp_id",
    "entry_date",
    "entry_id",
    "lot_id",
    "project_id",
    "shift_id",
    "stage"
)
SELECT
    "activity_id",
    "battery_id",
    "created_at",
    "duration_minutes",
    "emp_id",
    "entry_date",
    "entry_id",
    "lot_id",
    "project_id",
    "shift_id",
    "stage"
FROM "time_entries";

DROP TABLE "time_entries";
ALTER TABLE "new_time_entries" RENAME TO "time_entries";

CREATE INDEX "time_entries_emp_id_idx" ON "time_entries"("emp_id");
CREATE INDEX "time_entries_entry_date_idx" ON "time_entries"("entry_date");
CREATE INDEX "time_entries_shift_id_idx" ON "time_entries"("shift_id");
CREATE INDEX "time_entries_activity_id_idx" ON "time_entries"("activity_id");
CREATE INDEX "time_entries_project_id_idx" ON "time_entries"("project_id");
CREATE INDEX "time_entries_battery_id_idx" ON "time_entries"("battery_id");
CREATE INDEX "time_entries_lot_id_idx" ON "time_entries"("lot_id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
