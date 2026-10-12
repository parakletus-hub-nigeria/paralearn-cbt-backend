import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CandidatesService } from "./candidates.service";
import { BulkUpsertCandidatesDto, UpsertCandidateDto } from "./dto/candidate.dto";
import { Public } from "../access/public.decorator";
import { Caller, type CbtCaller } from "../access/caller.decorator";
import { CbtAccessService } from "../access/cbt-access.service";

@ApiTags("Candidates")
@Controller("candidates")
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly access: CbtAccessService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create or update one candidate on an exam roster" })
  async upsertCandidate(@Body() dto: UpsertCandidateDto, @Caller() caller: CbtCaller) {
    await this.access.assertExam(caller, dto.examId);
    return this.candidatesService.upsertCandidate(dto);
  }

  @Post("bulk")
  @ApiOperation({ summary: "Bulk create or update candidate roster entries" })
  async bulkUpsert(@Body() dto: BulkUpsertCandidatesDto, @Caller() caller: CbtCaller) {
    await this.access.assertExam(caller, dto.examId);
    return this.candidatesService.bulkUpsertCandidates(dto);
  }

  @Get()
  @ApiOperation({ summary: "List candidate roster entries for an exam" })
  @ApiQuery({ name: "examId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  async listCandidates(
    @Query("examId") examId: string,
    @Caller() caller: CbtCaller,
    @Query("search") search?: string
  ) {
    if (caller.kind === "workspace" || examId) await this.access.assertExam(caller, examId);
    return this.candidatesService.listExamCandidates(examId, search);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get candidate roster entry" })
  async getCandidate(@Param("id") id: string, @Caller() caller: CbtCaller) {
    await this.access.assertCandidate(caller, id);
    return this.candidatesService.getCandidateById(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove candidate from an exam roster" })
  async deleteCandidate(@Param("id") id: string, @Caller() caller: CbtCaller) {
    await this.access.assertCandidate(caller, id);
    return this.candidatesService.deleteCandidate(id);
  }
}
