import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ExamsService } from "./exams.service";
import { CreateExamDto, UpdateExamDto, AttachQuestionsDto } from "./dto/create-exam.dto";

@ApiTags("Exams")
@Controller("exams")
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new examination within a workspace" })
  createExam(@Body() dto: CreateExamDto) {
    return this.examsService.createExam(dto);
  }

  @Get()
  @ApiOperation({ summary: "List examinations for a specific workspace" })
  @ApiQuery({ name: "workspaceId", required: true, type: String })
  listExams(@Query("workspaceId") workspaceId: string) {
    return this.examsService.findWorkspaceExams(workspaceId);
  }

  @Get("code/:accessCode")
  @ApiOperation({ summary: "Candidate lobby verification by exam access code" })
  getExamByCode(@Param("accessCode") accessCode: string) {
    return this.examsService.findExamByAccessCode(accessCode);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get detailed exam configuration including questions" })
  getExamById(@Param("id") id: string) {
    return this.examsService.findExamById(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update exam settings, timing, or published status" })
  updateExam(@Param("id") id: string, @Body() dto: UpdateExamDto) {
    return this.examsService.updateExam(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an exam (only if no candidate attempts exist)" })
  deleteExam(@Param("id") id: string) {
    return this.examsService.deleteExam(id);
  }

  @Post(":id/questions")
  @ApiOperation({ summary: "Attach question list and update total marks" })
  attachQuestions(@Param("id") id: string, @Body() dto: AttachQuestionsDto) {
    return this.examsService.attachQuestions(id, dto);
  }

  @Get(":id/monitor")
  @ApiOperation({ summary: "Get real-time live invigilation board metrics and candidate roster" })
  getLiveMonitor(@Param("id") id: string) {
    return this.examsService.getLiveMonitorStats(id);
  }
}
