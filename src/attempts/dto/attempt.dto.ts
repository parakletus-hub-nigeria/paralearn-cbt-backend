import { IsString, IsNotEmpty, IsOptional, IsObject, IsBoolean, IsEmail } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StartAttemptDto {
  @ApiProperty({ description: "6-character or custom room access code", example: "JAMB-MOCK-26" })
  @IsString()
  @IsNotEmpty()
  accessCode!: string;

  @ApiPropertyOptional({
    description:
      "Candidate PIN or registration number. Required for ROSTER_ONLY exams; walk-in participants may omit it and one is issued.",
    example: "849201",
  })
  @IsString()
  @IsOptional()
  candidatePin?: string;

  @ApiProperty({ description: "Candidate full name", example: "Oluwaseun Adeleke" })
  @IsString()
  @IsNotEmpty()
  candidateName!: string;

  @ApiPropertyOptional({ description: "Participant email address", example: "seun@example.com" })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: "Participant phone number", example: "+2348012345678" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: "ParaLearn SIS student ID (if registered through school)", example: "stu_99381" })
  @IsString()
  @IsOptional()
  studentId?: string;

  @ApiPropertyOptional({ description: "Candidate IP address for telemetry audit" })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional({ description: "Candidate browser User-Agent" })
  @IsString()
  @IsOptional()
  userAgent?: string;
}

export class BufferAnswerDto {
  @ApiProperty({ description: "Question ID" })
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @ApiProperty({ description: "Selected answer payload (e.g. { selected: 'opt_a' } or string ID)", example: { selected: "opt_a" } })
  @IsNotEmpty()
  selectedVal!: any;
}

export class RecordTelemetryDto {
  @ApiProperty({ description: "Type of security violation", example: "tab_switch" })
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @ApiPropertyOptional({ description: "ISO timestamp of event" })
  @IsString()
  @IsOptional()
  timestamp?: string;

  @ApiPropertyOptional({ description: "Active question index when event occurred" })
  @IsOptional()
  questionIdx?: number;
}

export class SubmitAttemptDto {
  @ApiPropertyOptional({ description: "Whether submission was triggered by automatic timer expiration" })
  @IsBoolean()
  @IsOptional()
  autoSubmitted?: boolean;

  @ApiPropertyOptional({ description: "Final answer map dictionary from client localStorage cache" })
  @IsObject()
  @IsOptional()
  finalAnswers?: Record<string, any>;
}
