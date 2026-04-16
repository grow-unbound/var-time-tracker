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
