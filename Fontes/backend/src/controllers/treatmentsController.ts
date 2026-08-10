import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CreateTreatmentDTO } from "src/dashboard/dto/create/CreateTreatmentDTO";
import { UpdateTreatmentDTO } from "src/dashboard/dto/update/UpdateTreatmentDTO";

import { TreatmentsService } from "src/services/treatmentsService";

@Controller("treatments")
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) {}

  // Create
  @Post()
  create(
    @Body()
    dto: CreateTreatmentDTO,
  ) {
    return this.treatmentsService.create(dto);
  }

  // Listar todos os tratamentos
  @Get("institution/:id")
  findAllByInstitution(@Param("id", ParseUUIDPipe) id: string) {
    return this.treatmentsService.findAllByInstitution(id);
  }

  // Agenda
  @Get("agenda/missed/:id")
  async getMissed(
    @Param("id", ParseUUIDPipe)
    id: string,

    @Query("type")
    type: "user" | "patient" = "patient",
  ) {
    return this.treatmentsService.getMissedDoses(id, type);
  }

  @Get("agenda/today/:id")
  async getToday(
    @Param("id", ParseUUIDPipe)
    id: string,

    @Query("type")
    type: "user" | "patient" = "patient",
  ) {
    return this.treatmentsService.getDailyAgenda(id, type, new Date());
  }

  @Get("agenda/:id")
  getAgenda(
    @Param("id", ParseUUIDPipe)
    id: string,

    @Query("type")
    type: "user" | "patient" = "patient",
  ) {
    return this.treatmentsService.getDailyAgenda(id, type);
  }

  // Buscar tratamento específico
  @Get(":id")
  findOne(
    @Param("id", ParseUUIDPipe)
    id: string,
  ) {
    return this.treatmentsService.findOne(id);
  }

  // Atualizar tratamento
  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe)
    id: string,

    @Body()
    dto: UpdateTreatmentDTO,
  ) {
    return this.treatmentsService.update(id, dto);
  }

  @Patch("check-in/:doseId")
  async checkIn(
    @Param("doseId", ParseUUIDPipe)
    doseId: string,
  ) {
    return this.treatmentsService.checkInDose(doseId);
  }
}
