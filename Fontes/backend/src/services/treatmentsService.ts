import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, LessThan } from "typeorm";
import { Treatment } from "../entidades/Treatment";
import { DoseHistory } from "../entidades/DoseHistory";
import { User } from "../entidades/User";
import { Patient } from "../entidades/Patient";
import { CreateTreatmentDto } from "../dtos/treatmentsDTO";
import { UpdateTreatmentDTO } from "src/dashboard/dto/update/UpdateTreatmentDTO";

@Injectable()
export class TreatmentsService {
  constructor(
    @InjectRepository(Treatment)
    private treatmentRepository: Repository<Treatment>,
    @InjectRepository(DoseHistory)
    private doseHistoryRepository: Repository<DoseHistory>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  // Função para criar um novo tratamento e gerar seu histórico de doses
  async create(dto: CreateTreatmentDto) {
    let owner: { user?: User; patient?: Patient } = {};

    // Identifica se o tratamento pertence a um usuário autônomo
    // ou a um paciente vinculado a uma instituição
    if (dto.userCpf) {
      const user = await this.userRepository.findOne({
        where: { cpf: dto.userCpf },
      });

      if (!user)
        throw new NotFoundException(
          "Usuário autônomo não encontrado com este CPF",
        );

      owner.user = user;
    } else if (dto.patientCpf) {
      const patient = await this.patientRepository.findOne({
        where: { cpf: dto.patientCpf },
      });

      if (!patient)
        throw new NotFoundException(
          "Paciente da clínica não encontrado com este CPF",
        );

      owner.patient = patient;
    }

    const treatment = this.treatmentRepository.create({
      intervalHours: dto.intervalHours,
      durationDays: dto.durationDays,
      startDate: new Date(dto.startDate),
      medication: { id: dto.medicationId },
      user: owner.user,
      patient: owner.patient,
    });

    const saved = await this.treatmentRepository.save(treatment);

    // Gera automaticamente todas as doses previstas para o tratamento
    await this.generateDoses(saved);

    return saved;
  }

  // Função para gerar o histórico de doses de um tratamento
  private async generateDoses(treatment: Treatment) {
    const doses: DoseHistory[] = [];
    const totalDoses = Math.floor(
      (24 / treatment.intervalHours) * treatment.durationDays,
    );

    let nextDoseTime = new Date(treatment.startDate);

    for (let i = 0; i < totalDoses; i++) {
      const dose = this.doseHistoryRepository.create({
        treatment,
        scheduledTime: new Date(nextDoseTime),
        isTaken: false,
      });

      doses.push(dose);

      nextDoseTime.setHours(nextDoseTime.getHours() + treatment.intervalHours);
    }

    await this.doseHistoryRepository.save(doses);
  }

  // Função para buscar a agenda de doses de um dia específico
  async getDailyAgenda(
    id: string,
    type: "user" | "patient",
    date: Date = new Date(),
  ) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Define o filtro conforme o tipo de perfil informado
    const whereCondition =
      type === "user"
        ? { treatment: { user: { id } } }
        : { treatment: { patient: { id } } };

    return this.doseHistoryRepository.find({
      where: {
        ...whereCondition,
        scheduledTime: Between(startOfDay, endOfDay),
      },
      relations: {
        treatment: {
          medication: true,
        },
      },
      order: {
        scheduledTime: "ASC",
      },
    });
  }

  // Função para buscar todas as doses em atraso
  async getMissedDoses(id: string, type: "user" | "patient") {
    // Define o filtro conforme o tipo de perfil informado
    const whereCondition =
      type === "user"
        ? { treatment: { user: { id } } }
        : { treatment: { patient: { id } } };

    return this.doseHistoryRepository.find({
      where: {
        ...whereCondition,
        scheduledTime: LessThan(new Date()),
        isTaken: false,
      },
      relations: {
        treatment: {
          medication: true,
        },
      },
      order: {
        scheduledTime: "DESC",
      },
    });
  }

  // Função para registrar que uma dose foi administrada
  async checkInDose(doseId: string): Promise<DoseHistory> {
    const dose = await this.doseHistoryRepository.findOne({
      where: { id: doseId },
      relations: {
        treatment: true,
      },
    });

    if (!dose) {
      throw new NotFoundException("Dose não encontrada");
    }

    if (dose.isTaken) {
      throw new BadRequestException("Esta dose já foi marcada como tomada");
    }

    dose.isTaken = true;
    dose.takenAt = new Date();

    return this.doseHistoryRepository.save(dose);
  }

  // Função para buscar todos os tratamentos de um usuário ou paciente
  async findAllByCpf(
    cpf: string,
    type: "user" | "patient",
    status?: "ACTIVE" | "FINISHED" | "CANCELLED",
  ) {
    // Define o filtro conforme o tipo de perfil informado
    const whereCondition: any =
      type === "user"
        ? {
            user: { cpf },
          }
        : {
            patient: { cpf },
          };

    // Aplica o filtro de status quando informado
    if (status) {
      whereCondition.status = status;
    }

    return this.treatmentRepository.find({
      where: whereCondition,
      relations: {
        medication: true,
        history: true,
      },
      order: {
        history: {
          scheduledTime: "ASC",
        },
      },
    });
  }

  async findAll() {
    return this.treatmentRepository.find({
      relations: {
        user: true,
        patient: true,
        medication: true,
      },

      order: {
        startDate: "DESC",
      },
    });
  }

  async findAllByInstitution(id: string) {
    return this.treatmentRepository.find({
      where: {
        id,
      },

      relations: {
        user: true,
        patient: true,
        medication: true,
      },

      order: {
        startDate: "DESC",
      },
    });
  }

  async findOne(id: string) {
    const treatment = await this.treatmentRepository.findOne({
      where: {
        id,
      },

      relations: {
        user: true,
        patient: true,
        medication: true,
      },
    });

    if (!treatment) {
      throw new NotFoundException("Tratamento não encontrado");
    }

    return treatment;
  }

  async update(id: string, dto: UpdateTreatmentDTO) {
    const treatment = await this.findOne(id);

    if (dto.medicationId) {
      treatment.medication = {
        id: dto.medicationId,
      } as any;
    }

    if (dto.intervalHours !== undefined) {
      treatment.intervalHours = dto.intervalHours;
    }

    if (dto.durationDays !== undefined) {
      treatment.durationDays = dto.durationDays;
    }

    if (dto.startDate) {
      treatment.startDate = new Date(dto.startDate);
    }

    if (dto.status) {
      treatment.status = dto.status;
    }

    if (dto.notes !== undefined) {
      treatment.notes = dto.notes;
    }

    return this.treatmentRepository.save(treatment);
  }
}
