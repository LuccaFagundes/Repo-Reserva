export class TreatmentSummaryDto {

    id!: string;

    medicationId!: string;

    medication!: string;

    dosage!: string;

    dosageForm!: string;

    intervalHours!: number;

    durationDays!: number;

    startDate!: Date;

    nextDose?: Date;

    status!: string;

    patientName?: string;

}