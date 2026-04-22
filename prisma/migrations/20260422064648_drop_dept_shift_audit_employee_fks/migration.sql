-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_created_by_fkey";

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_updated_by_fkey";

-- DropForeignKey
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_created_by_fkey";

-- DropForeignKey
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_updated_by_fkey";
