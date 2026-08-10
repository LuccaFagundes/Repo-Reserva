import { Injectable } from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";

import { Repository } from "typeorm";

import { Institution } from "../entidades/Institution";
import { Patient } from "../entidades/Patient";
import { Treatment } from "../entidades/Treatment";
import { DoseHistory } from "../entidades/DoseHistory";

import { InstitutionDashboardDto } from "./dto/dashboard/InstitutionDashDTO";
import { PatientDashboardDto } from "./dto/dashboard/PatientDashDTO";
import { UserDashboardDto } from "./dto/dashboard/UserDashDTO";

import { PatientsService } from "src/services/patientsService";
import { ReportsService } from "src/services/reportsService";
import { TreatmentsService } from "src/services/treatmentsService";
import { TreatmentSummaryDto } from "./dto/summary/TreatmentSummaryDTO";
import { TodayAgendaDto } from "./dto/TodayAgendaDTO";
import { InstitutionStatisticsDto } from "./dto/summary/InstitutionStatisticsDTO";
import { InstitutionsService } from "src/services/institutionService";
import { PatientSummaryDto } from "./dto/summary/PatientSummaryDTO";
import { UsersService } from "src/services/usersService";

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(DoseHistory)
    private readonly doseHistoryRepository: Repository<DoseHistory>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(Treatment)
    private readonly treatmentRepository: Repository<Treatment>,

    @InjectRepository(Institution)
    private readonly institutionRepository: Repository<Treatment>,

    private readonly reportsService: ReportsService,
    private readonly treatmentsService: TreatmentsService,
    private readonly patientsService: PatientsService,
    private readonly institutionsService: InstitutionsService,
    private readonly usersService: UsersService,
  ) {}
  //===========================================================User==============================================================================================

  async getUserDashboard(userId: string): Promise<UserDashboardDto> {
    const user = await this.usersService.findOne(userId);

    const summary = await this.buildTreatmentSummary(user.cpf, user.id, "user");

    const agenda = await this.treatmentsService.getDailyAgenda(user.id, "user");

    const nextDose = this.getNextDose(summary.treatments);

    return {
      user: {
        id: user.id,

        name: user.name,

        cpf: user.cpf,

        email: user.email,
      },

      adherence: summary.adherence,

      nextDose: nextDose
        ? {
            doseId: nextDose.id,

            medication: nextDose.treatment.medication.name,

            scheduledTime: nextDose.scheduledTime,
          }
        : undefined,

      activeTreatments: summary.treatments.map((treatment) =>
        this.buildTreatmentDto(treatment),
      ),

      todayAgenda: this.buildTodayAgenda(agenda),
    };
  }
  //===========================================================Institution===================================================================================

  async getInstitutionDashboard(
    institutionId: string,
  ): Promise<InstitutionDashboardDto> {
    const institution = await this.institutionsService.findOne(institutionId);

    const statistics = await this.getInstitutionStatistics(institutionId);

    const patients = await this.getPatientSummaries(institution.patients);

    const todayAgenda = await this.getInstitutionTodayAgenda(
      institution.patients,
    );

    const activeTreatments = await this.getActiveTreatments(
      institution.patients,
    );

    return {
      institution: {
        id: institution.id,

        name: institution.name,

        cnpj: institution.cnpj,
      },

      statistics,

      patients,

      todayAgenda,

      activeTreatments,
    };
  }

  private async getActiveTreatments(
    patients: Patient[],
  ): Promise<TreatmentSummaryDto[]> {
    const activeTreatments: TreatmentSummaryDto[] = [];

    for (const patient of patients) {
      const treatments = patient.treatments.filter(
        (treatment) => treatment.status === "ACTIVE",
      );

      for (const treatment of treatments) {
        activeTreatments.push({
          id: treatment.id,

          medicationId: treatment.medication.id,

          medication: treatment.medication.name,

          dosage: treatment.medication.pharmaceuticalForm,

          dosageForm: treatment.medication.dosage,

          intervalHours: treatment.intervalHours,

          durationDays: treatment.durationDays,

          startDate: treatment.startDate,

          status: treatment.status,

          patientName: patient.name,
        });
      }
    }

    return activeTreatments;
  }

  private async getInstitutionTodayAgenda(
    patients: Patient[],
  ): Promise<TodayAgendaDto[]> {
    const agenda: TodayAgendaDto[] = [];

    for (const patient of patients) {
      const patientAgenda = await this.treatmentsService.getDailyAgenda(
        patient.id,
        "patient",
      );

      const dto = this.buildTodayAgenda(patientAgenda);

      dto.forEach((item) => {
        item.patientId = patient.id;

        item.patientName = patient.name;
      });

      agenda.push(...dto);
    }

    return agenda.sort(
      (a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime(),
    );
  }

  private async getInstitutionStatistics(
    institutionId: string,
  ): Promise<InstitutionStatisticsDto> {
    const institution = await this.institutionsService.findOne(institutionId);

    const patientIds = institution.patients.map((patient) => patient.id);

    let activeTreatments = 0;
    let todayDoses = 0;
    let takenToday = 0;
    let missedToday = 0;

    const today = new Date();

    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    let totalDoses = 0;
    let totalTaken = 0;

    for (const patientId of patientIds) {
      const agenda = await this.treatmentsService.getDailyAgenda(
        patientId,
        "patient",
        today,
      );

      todayDoses += agenda.length;

      takenToday += agenda.filter((dose) => dose.isTaken).length;

      missedToday += agenda.filter(
        (dose) => !dose.isTaken && dose.scheduledTime < new Date(),
      ).length;

      const adherence = await this.reportsService.getAdherence(
        patientId,
        "patient",
      );

      totalDoses += adherence.totalDoses;
      totalTaken += adherence.takenDoses;

      const patient = await this.patientsService.findOne(patientId);

      activeTreatments += patient.treatments.filter(
        (treatment) => treatment.status === "ACTIVE",
      ).length;
    }

    return {
      totalPatients: institution.patients.length,

      activeTreatments,

      todayDoses,

      takenToday,

      missedToday,

      adherencePercentage:
        totalDoses === 0 ? 0 : Math.round((totalTaken / totalDoses) * 100),
    };
  }

  private async getPatientSummaries(
    patients: Patient[],
  ): Promise<PatientSummaryDto[]> {
    const summaries: PatientSummaryDto[] = [];

    for (const patient of patients) {
      const summary = await this.buildTreatmentSummary(
        patient.cpf,
        patient.id,
        "patient",
      );

      const nextDose = this.getNextDose(summary.treatments);

      summaries.push({
        id: patient.id,

        name: patient.name,

        cpf: patient.cpf,

        activeTreatments: summary.treatments.length,

        adherencePercentage: summary.adherence.percentage,

        nextDose: nextDose?.scheduledTime,
      });
    }

    return summaries;
  }

  //===========================================================Patient=======================================================================================

  async getPatientDashboard(patientId: string): Promise<PatientDashboardDto> {
    const patient = await this.patientsService.findOne(patientId);

    const summary = await this.buildTreatmentSummary(
      patient.cpf,
      patient.id,
      "patient",
    );

    const nextDose = this.getNextDose(summary.treatments);

    const todayAgenda = await this.treatmentsService.getDailyAgenda(
      patient.id,
      "patient",
    );

    return {
      patient: {
        id: patient.id,

        name: patient.name,

        cpf: patient.cpf,

        institution: patient.institution?.name,
      },

      adherence: summary.adherence,

      nextDose: nextDose
        ? {
            doseId: nextDose.id,
            medication: nextDose.treatment.medication.name,
            scheduledTime: nextDose.scheduledTime,
          }
        : undefined,

      activeTreatments: summary.treatments.map((treatment) =>
        this.buildTreatmentDto(treatment),
      ),

      todayAgenda: this.buildTodayAgenda(todayAgenda),
    };
  }

  private async buildTreatmentSummary(
    cpf: string,
    ownerId: string,
    type: "user" | "patient",
  ) {
    const treatments = await this.treatmentsService.findAllByCpf(
      cpf,
      type,
      "ACTIVE",
    );

    const adherence = await this.reportsService.getAdherence(ownerId, type);

    return {
      treatments,
      adherence,
      nextDose: this.getNextDose(treatments),
    };
  }

  private buildTreatmentDto(treatment: Treatment): TreatmentSummaryDto {
    const nextDose = this.getNextDose([treatment]);

    return {
      id: treatment.id,
      medicationId: treatment.medication.id,
      medication: treatment.medication.name,
      dosage: treatment.medication.pharmaceuticalForm,
      dosageForm: treatment.medication.dosage,
      intervalHours: treatment.intervalHours,
      durationDays: treatment.durationDays,
      startDate: treatment.startDate,
      status: treatment.status,
      nextDose: nextDose?.scheduledTime,
    };
  }

  private buildTodayAgenda(agenda: DoseHistory[]): TodayAgendaDto[] {
    return agenda.map((dose) => ({
      doseId: dose.id,

      medication: dose.treatment.medication.name,

      dosage: dose.treatment.medication.dosage,

      scheduledTime: dose.scheduledTime,

      isTaken: dose.isTaken,

      canCheckIn: !dose.isTaken,
    }));
  }

  private getNextDose(treatments: Treatment[]): DoseHistory | undefined {
    const now = new Date();

    return treatments
      .flatMap((treatment) => treatment.history)
      .filter((dose) => !dose.isTaken && dose.scheduledTime >= now)
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())[0];
  }
}
