import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UpsertCandidateDto {
  @ApiProperty({ description: "Target exam ID" })
  @IsString()
  @IsNotEmpty()
  examId!: string;

  @ApiProperty({ description: "Candidate full name", example: "Oluwaseun Adeleke" })
  @IsString()
  @IsNotEmpty()
  candidateName!: string;

  @ApiProperty({ description: "Unique candidate PIN or registration number", example: "849201" })
  @IsString()
  @IsNotEmpty()
  candidatePin!: string;

  @ApiPropertyOptional({ description: "ParaLearn SIS student ID" })
  @IsString()
  @IsOptional()
  studentId?: string;

  @ApiPropertyOptional({ description: "Candidate email address" })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: "Candidate phone number" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: "Additional roster metadata" })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CandidateRosterItemDto {
  @ApiProperty({ description: "Candidate full name", example: "Oluwaseun Adeleke" })
  @IsString()
  @IsNotEmpty()
  candidateName!: string;

  @ApiProperty({ description: "Unique candidate PIN or registration number", example: "849201" })
  @IsString()
  @IsNotEmpty()
  candidatePin!: string;

  @ApiPropertyOptional({ description: "ParaLearn SIS student ID" })
  @IsString()
  @IsOptional()
  studentId?: string;

  @ApiPropertyOptional({ description: "Candidate email address" })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: "Candidate phone number" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: "Additional roster metadata" })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class BulkUpsertCandidatesDto {
  @ApiProperty({ description: "Target exam ID" })
  @IsString()
  @IsNotEmpty()
  examId!: string;

  @ApiProperty({ type: [CandidateRosterItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CandidateRosterItemDto)
  candidates!: CandidateRosterItemDto[];
}
