/**
 * 1.1.1 (Rob, 17 Oct): a junior medic's card says what she is and the role she
 * works as: "Registrar · Team Doctor", "Physio Assistant · Physiotherapist",
 * "Orthopaedic Surgeon · Medical Specialist". Promoted, she is her role alone.
 */
import { staffTitle } from "@shared/staff-roles";

export function roleWithGrade(roleLabel: string, grade: string | null | undefined): string {
  return grade ? `${staffTitle(roleLabel, grade)} · ${roleLabel}` : roleLabel;
}
