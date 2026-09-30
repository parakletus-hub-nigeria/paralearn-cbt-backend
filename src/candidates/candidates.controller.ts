import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CandidatesService } from "./candidates.service";
import { BulkUpsertCandidatesDto, UpsertCandidateDto } from "./dto/candidate.dto";

@ApiTags("Candidates")
@Controller("candidates")
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post()
  @ApiOperation({ summary: "Create or update one candidate on an exam roster" })
  upsertCandidate(@Body() dto: UpsertCandidateDto) {
    return this.candidatesService.upsertCandidate(dto);
  }

  @Post("bulk")
  @ApiOperation({ summary: "Bulk create or update candidate roster entries" })
  bulkUpsert(@Body() dto: BulkUpsertCandidatesDto) {
    return this.candidatesService.bulkUpsertCandidates(dto);
  }

  @Get()
  @ApiOperation({ summary: "List candidate roster entries for an exam" })
  @ApiQuery({ name: "examId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  listCandidates(@Query("examId") examId: string, @Query("search") search?: string) {
    return this.candidatesService.listExamCandidates(examId, search);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get candidate roster entry" })
  getCandidate(@Param("id") id: string) {
    return this.candidatesService.getCandidateById(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove candidate from an exam roster" })
  deleteCandidate(@Param("id") id: string) {
    return this.candidatesService.deleteCandidate(id);
  }
}
