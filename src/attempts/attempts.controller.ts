import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AttemptsService } from "./attempts.service";
import {
  StartAttemptDto,
  BufferAnswerDto,
  RecordTelemetryDto,
  SubmitAttemptDto,
  ManualGradeAttemptDto,
} from "./dto/attempt.dto";

@ApiTags("Attempts")
@Controller("attempts")
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post("start")
  @ApiOperation({ summary: "Validate PIN, start candidate exam session and timer" })
  startAttempt(@Body() dto: StartAttemptDto) {
    return this.attemptsService.startAttempt(dto);
  }

  @Post(":id/answer")
  @ApiOperation({ summary: "Buffer ephemeral candidate answer selection (Redis high-throughput)" })
  bufferAnswer(@Param("id") attemptId: string, @Body() dto: BufferAnswerDto) {
    return this.attemptsService.bufferAnswer(attemptId, dto);
  }

  @Post(":id/telemetry")
  @ApiOperation({ summary: "Report tab switch, blur, or fullscreen exit event for proctoring" })
  recordTelemetry(@Param("id") attemptId: string, @Body() dto: RecordTelemetryDto) {
    return this.attemptsService.recordTelemetry(attemptId, dto);
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Atomically submit exam and trigger deterministic auto-grading" })
  submitAttempt(@Param("id") attemptId: string, @Body() dto: SubmitAttemptDto) {
    return this.attemptsService.submitAttempt(attemptId, dto);
  }

  @Get(":id/slip")
  @ApiOperation({ summary: "Get candidate result slip" })
  getResultSlip(@Param("id") attemptId: string) {
    return this.attemptsService.getCandidateResultSlip(attemptId);
  }

  @Get(":id/review")
  @ApiOperation({ summary: "Get submitted attempt answers and question metadata for examiner review" })
  getReviewPayload(@Param("id") attemptId: string) {
    return this.attemptsService.getAttemptReviewPayload(attemptId);
  }

  @Post(":id/manual-grade")
  @ApiOperation({ summary: "Apply examiner manual marks and recalculate final score" })
  manualGradeAttempt(@Param("id") attemptId: string, @Body() dto: ManualGradeAttemptDto) {
    return this.attemptsService.manualGradeAttempt(attemptId, dto);
  }
}
