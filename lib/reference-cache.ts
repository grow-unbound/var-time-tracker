import type {
  DepartmentDto,
  ProjectDto,
  ShiftDto,
} from "@/lib/api-dtos";

const STORAGE_KEY = "var_tt_ref_bundle_v1";
const TTL_MS = 60 * 60 * 1000;

export interface CachedReferenceBundle {
  fetchedAt: number;
  departments: DepartmentDto[];
  shifts: ShiftDto[];
  projects: ProjectDto[];
}

export function readReferenceCache(): CachedReferenceBundle | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedReferenceBundle;
    if (
      typeof parsed.fetchedAt !== "number" ||
      !Array.isArray(parsed.departments) ||
      !Array.isArray(parsed.shifts) ||
      !Array.isArray(parsed.projects)
    ) {
      return null;
    }
    if (Date.now() - parsed.fetchedAt > TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeReferenceCache(
  bundle: Pick<CachedReferenceBundle, "departments" | "shifts" | "projects">,
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    const payload: CachedReferenceBundle = {
      ...bundle,
      fetchedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
