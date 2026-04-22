/** DTOs for competency matrix APIs */

/** Matrix API `statuses` filter tokens (multi-select; empty = all). */
export type CompetencyStatusToken = "active" | "expired" | "expiring";

export interface CompetencyMatrixWorkerDto {
  empId: string;
  firstName: string;
  lastName: string;
  departmentId: number;
  departmentName: string;
  departmentCode: string;
}

export interface CompetencyMatrixActivityDto {
  id: number;
  name: string;
  departmentId: number;
}

export interface CompetencyMatrixDepartmentDto {
  id: number;
  name: string;
  deptCode: string;
}

export interface CompetencyMatrixCellDto {
  competencyId: number;
  employeeId: string;
  activityId: number;
  level: number | null;
  activeDate: string;
  expiryDate: string | null;
}

export interface CompetencyMatrixResponseDto {
  workers: CompetencyMatrixWorkerDto[];
  activities: CompetencyMatrixActivityDto[];
  departments: CompetencyMatrixDepartmentDto[];
  competencies: CompetencyMatrixCellDto[];
  page: number;
  limit: number;
  totalWorkers: number;
}

export interface CompetencyKpisResponseDto {
  lowCoverageActivities: number;
  lowSkillWorkers: number;
  expired: number;
  expiringSoon: number;
}

export interface CompetencyUpsertResponseDto {
  competency: CompetencyMatrixCellDto;
}
