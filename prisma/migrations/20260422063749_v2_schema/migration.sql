-- CreateEnum
CREATE TYPE "SubProjectStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'on_hold');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('pending', 'achieved', 'missed');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001';

-- AlterTable
ALTER TABLE "battery_models" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001';

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001';

-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "actual_end" DATE,
ADD COLUMN     "actual_start" DATE,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
ADD COLUMN     "planned_end" DATE,
ADD COLUMN     "planned_start" DATE,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001';

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001';

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001';

-- CreateTable
CREATE TABLE "sub_projects" (
    "sub_project_id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "dept_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SubProjectStatus" NOT NULL DEFAULT 'not_started',
    "planned_start" DATE,
    "planned_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "baseline_start" DATE,
    "baseline_end" DATE,
    "predecessor_sub_project_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
    "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',

    CONSTRAINT "sub_projects_pkey" PRIMARY KEY ("sub_project_id")
);

-- CreateTable
CREATE TABLE "employee_competencies" (
    "competency_id" SERIAL NOT NULL,
    "emp_id" TEXT NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "level" INTEGER,
    "active_date" DATE NOT NULL,
    "expiry_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
    "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',

    CONSTRAINT "employee_competencies_pkey" PRIMARY KEY ("competency_id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "assignment_id" SERIAL NOT NULL,
    "emp_id" TEXT NOT NULL,
    "sub_project_id" INTEGER NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "shift_date" DATE NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "duration" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
    "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "milestone_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "project_id" INTEGER,
    "sub_project_id" INTEGER,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',
    "updated_by" TEXT NOT NULL DEFAULT 'PROJMGMT-001',

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("milestone_id")
);

-- CreateIndex
CREATE INDEX "sub_projects_project_id_idx" ON "sub_projects"("project_id");

-- CreateIndex
CREATE INDEX "sub_projects_dept_id_idx" ON "sub_projects"("dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "sub_projects_project_id_dept_id_key" ON "sub_projects"("project_id", "dept_id");

-- CreateIndex
CREATE INDEX "employee_competencies_activity_id_idx" ON "employee_competencies"("activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_competencies_emp_id_activity_id_key" ON "employee_competencies"("emp_id", "activity_id");

-- CreateIndex
CREATE INDEX "shift_assignments_emp_id_idx" ON "shift_assignments"("emp_id");

-- CreateIndex
CREATE INDEX "shift_assignments_sub_project_id_idx" ON "shift_assignments"("sub_project_id");

-- CreateIndex
CREATE INDEX "shift_assignments_shift_date_idx" ON "shift_assignments"("shift_date");

-- CreateIndex
CREATE INDEX "milestones_project_id_idx" ON "milestones"("project_id");

-- CreateIndex
CREATE INDEX "milestones_sub_project_id_idx" ON "milestones"("sub_project_id");

-- CreateIndex
CREATE INDEX "milestones_target_date_idx" ON "milestones"("target_date");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battery_models" ADD CONSTRAINT "battery_models_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battery_models" ADD CONSTRAINT "battery_models_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_projects" ADD CONSTRAINT "sub_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_projects" ADD CONSTRAINT "sub_projects_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_projects" ADD CONSTRAINT "sub_projects_predecessor_sub_project_id_fkey" FOREIGN KEY ("predecessor_sub_project_id") REFERENCES "sub_projects"("sub_project_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_projects" ADD CONSTRAINT "sub_projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_projects" ADD CONSTRAINT "sub_projects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_competencies" ADD CONSTRAINT "employee_competencies_emp_id_fkey" FOREIGN KEY ("emp_id") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_competencies" ADD CONSTRAINT "employee_competencies_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("activity_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_competencies" ADD CONSTRAINT "employee_competencies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_competencies" ADD CONSTRAINT "employee_competencies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_emp_id_fkey" FOREIGN KEY ("emp_id") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_sub_project_id_fkey" FOREIGN KEY ("sub_project_id") REFERENCES "sub_projects"("sub_project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("activity_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("shift_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_sub_project_id_fkey" FOREIGN KEY ("sub_project_id") REFERENCES "sub_projects"("sub_project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraints (v2 spec / plan)
ALTER TABLE "employee_competencies" ADD CONSTRAINT "employee_competencies_level_check" CHECK ("level" IS NULL OR "level" IN (0, 1, 2));

ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_xor_subproject_check" CHECK (
    ("project_id" IS NOT NULL AND "sub_project_id" IS NULL)
    OR ("project_id" IS NULL AND "sub_project_id" IS NOT NULL)
);

ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_duration_check" CHECK ("duration" > 0 AND "duration" <= 8);
