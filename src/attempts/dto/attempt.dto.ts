import { IsString, IsNotEmpty, IsOptional, IsObject, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StartAttemptDto {
  @ApiProperty({ description: "6-character or custom room access code", example: "JAMB-MOCK-26" })
  @IsString()
  @IsNotEmpty()
  accessCode!: string;

  @ApiProperty({ description: "Candidate's unique 6-digit PIN or registration number", example: "849201" })
  @IsString()
  @IsNotEmpty()
  candidatePin!: string;

  @ApiProperty({ description: "Candidate full name", example: "Oluwaseun Adeleke" })
  @IsString()
  @IsNotEmpty()
  candidateName!: string;

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
