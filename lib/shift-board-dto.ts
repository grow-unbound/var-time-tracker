export interface ShiftBoardRowDto {
  departmentId: number;
  departmentName: string;
  activityId: number;
  activityName: string;
}

export interface ShiftBoardColDto {
  projectId: number;
  projectCode: string;
  projectName: string;
  colorKey: string;
}

/** SubProject for (project × activity's department), if any. */
export interface ShiftBoardCellKeyDto {
  activityId: number;
  projectId: number;
  subProjectId: number | null;
  /** When subProject exists and status is in_progress or not_started with coverage expectation */
  mayNeedCoverage: boolean;
}

export interface ShiftBoardAssignmentDto {
  assignmentId: number;
  empId: string;
  firstName: string;
  lastName: string;
  activityId: number;
  projectId: number;
  subProjectId: number;
  departmentId: number;
  durationHours: string;
  assignmentCountForEmployee: number;
}

export interface ShiftBoardEmployeeQualDto {
  empId: string;
  firstName: string;
  lastName: string;
  departmentId: number;
  validActivityIds: number[];
}

export interface ShiftBoardResponseDto {
  rows: ShiftBoardRowDto[];
  cols: ShiftBoardColDto[];
  cells: ShiftBoardCellKeyDto[];
  assignments: ShiftBoardAssignmentDto[];
  qualifications: ShiftBoardEmployeeQualDto[];
  shiftDate: string;
  shiftId: number;
}

export interface ShiftBoardPersonAssignmentDto {
  assignmentId: number;
  projectId: number;
  projectName: string;
  projectCode: string;
  colorKey: string;
  activityId: number;
  activityName: string;
  subProjectId: number;
  durationHours: string;
}

export interface ShiftBoardPersonRowDto {
  empId: string;
  firstName: string;
  lastName: string;
  departmentId: number;
  departmentName: string;
  totalHours: string;
  isUnassigned: boolean;
  assignments: ShiftBoardPersonAssignmentDto[];
}

export interface ShiftBoardPersonResponseDto {
  employees: ShiftBoardPersonRowDto[];
  shiftDate: string;
  shiftId: number;
}

export interface PostShiftAssignmentResponseDto {
  ok: true;
  assignment: {
    id: number;
  };
}
