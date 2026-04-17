/** Matches Prisma `TimeEntryStage` JSON serialization. */
export type DashboardStage = "RnD" | "Production";

export interface DashboardMetricsDto {
  totalHours: number;
  activeProjects: number;
  employeesLogged: number;
  entriesToday: number;
  lastEntryAt: string | null;
}

export interface DashboardPrimaryRowDto {
  projectId: number;
  projectName: string;
  batteryId: number;
  batteryName: string;
  stage: DashboardStage;
  hours: number;
}

export interface DashboardDepartmentHoursDto {
  departmentId: number;
  departmentName: string;
  rndHours: number;
  productionHours: number;
}

export interface DashboardEmployeeHoursDto {
  employeeId: string;
  displayName: string;
  rndHours: number;
  productionHours: number;
}

export interface DashboardSecondaryDto {
  byDepartment: DashboardDepartmentHoursDto[];
  byEmployee: DashboardEmployeeHoursDto[];
}

export interface DashboardResponseDto {
  metrics: DashboardMetricsDto;
  primary: DashboardPrimaryRowDto[];
  secondary: DashboardSecondaryDto;
}
