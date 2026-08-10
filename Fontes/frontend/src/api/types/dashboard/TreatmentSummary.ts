export interface TreatmentSummary {
  id: string;

  medicationId: string;

  medication: string;

  dosage: string;

  dosageForm: string;

  intervalHours: number;

  durationDays: number;

  startDate: string;

  nextDose?: string;

  status: string;

  patientName?: string;
}
