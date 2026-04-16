-- CreateTable
CREATE TABLE "departments" (
    "dept_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dept_code" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "shifts" (
    "shift_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "employees" (
    "emp_id" TEXT NOT NULL PRIMARY KEY,
    "emp_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "dept_id" INTEGER NOT NULL,
    "shift_id" INTEGER NOT NULL,
    CONSTRAINT "employees_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments" ("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "employees_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("shift_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activities" (
    "activity_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "dept_id" INTEGER NOT NULL,
    CONSTRAINT "activities_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments" ("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "project_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "project_code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "battery_models" (
    "battery_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "model_name" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    CONSTRAINT "battery_models_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("project_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lots" (
    "lot_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lot_number" TEXT NOT NULL,
    "battery_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "lots_battery_id_fkey" FOREIGN KEY ("battery_id") REFERENCES "battery_models" ("battery_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("project_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "time_entries" (
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
    CONSTRAINT "time_entries_emp_id_fkey" FOREIGN KEY ("emp_id") REFERENCES "employees" ("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("shift_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities" ("activity_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("project_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_battery_id_fkey" FOREIGN KEY ("battery_id") REFERENCES "battery_models" ("battery_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_entries_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots" ("lot_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_dept_code_key" ON "departments"("dept_code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_name_key" ON "shifts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_emp_code_key" ON "employees"("emp_code");

-- CreateIndex
CREATE INDEX "employees_dept_id_idx" ON "employees"("dept_id");

-- CreateIndex
CREATE INDEX "employees_shift_id_idx" ON "employees"("shift_id");

-- CreateIndex
CREATE INDEX "activities_dept_id_idx" ON "activities"("dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "activities_dept_id_name_key" ON "activities"("dept_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_code_key" ON "projects"("project_code");

-- CreateIndex
CREATE INDEX "battery_models_project_id_idx" ON "battery_models"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "battery_models_project_id_model_name_key" ON "battery_models"("project_id", "model_name");

-- CreateIndex
CREATE INDEX "lots_battery_id_idx" ON "lots"("battery_id");

-- CreateIndex
CREATE INDEX "lots_project_id_idx" ON "lots"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "lots_battery_id_lot_number_key" ON "lots"("battery_id", "lot_number");

-- CreateIndex
CREATE INDEX "time_entries_emp_id_idx" ON "time_entries"("emp_id");

-- CreateIndex
CREATE INDEX "time_entries_entry_date_idx" ON "time_entries"("entry_date");

-- CreateIndex
CREATE INDEX "time_entries_shift_id_idx" ON "time_entries"("shift_id");

-- CreateIndex
CREATE INDEX "time_entries_activity_id_idx" ON "time_entries"("activity_id");

-- CreateIndex
CREATE INDEX "time_entries_project_id_idx" ON "time_entries"("project_id");

-- CreateIndex
CREATE INDEX "time_entries_battery_id_idx" ON "time_entries"("battery_id");

-- CreateIndex
CREATE INDEX "time_entries_lot_id_idx" ON "time_entries"("lot_id");
