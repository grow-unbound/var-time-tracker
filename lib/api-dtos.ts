export interface DepartmentDto {
  id: number;
  deptCode: string;
  name: string;
}

export interface ShiftDto {
  id: number;
  name: string;
}

export interface EmployeeDto {
  empId: string;
  empCode: string;
  firstName: string;
  lastName: string;
  shiftId: number;
}

export interface ActivityDto {
  id: number;
  name: string;
}

export interface ProjectDto {
  id: number;
  name: string;
  projectCode: string;
}

export interface BatteryDto {
  id: number;
  modelName: string;
  projectId: number;
}

export interface LotDto {
  id: number;
  lotNumber: string;
  batteryId: number;
  projectId: number;
}

export interface ShiftCheckResponse {
  locked: boolean;
  shiftId?: number;
}

/** API stage values match Prisma `TimeEntryStage` serialization. */
export type TimeEntryStageDto = "RnD" | "Production";

export interface TimeEntryListItemDto {
  id: number;
  entryDate: string;
  createdAt: string;
  employeeLabel: string;
  departmentName: string;
  projectName: string;
  batteryModelName: string;
  lotNumber: string | null;
  stage: TimeEntryStageDto;
  activityName: string;
  durationMinutes: number;
}

export interface EntriesListResponse {
  entries: TimeEntryListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Latest `createdAt` among rows matching filters (not limited to current page). */
  lastEntryAt: string | null;
}
