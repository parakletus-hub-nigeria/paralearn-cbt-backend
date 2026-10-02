import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsEnum, Min, Max, IsArray } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum AccessTypeEnum {
  ROSTER_ONLY = "ROSTER_ONLY",
  PUBLIC_LINK = "PUBLIC_LINK",
  ACCESS_CODE = "ACCESS_CODE",
}

export class CreateExamDto {
  @ApiProperty({ description: "Target workspace ID" })
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @ApiProperty({ description: "Title of the examination", example: "JAMB UTME 2026 Mock - Physics" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: "Instructions displayed to candidate in lobby" })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({ description: "Duration in minutes", default: 60 })
  @IsInt()
  @Min(1)
  @Max(360)
  @IsOptional()
  durationMins?: number;

  @ApiPropertyOptional({ description: "Access type", enum: AccessTypeEnum, default: AccessTypeEnum.ACCESS_CODE })
  @IsEnum(AccessTypeEnum)
  @IsOptional()
  accessType?: AccessTypeEnum;

  @ApiPropertyOptional({ description: "Custom access code (generated automatically if omitted)", example: "JAMB-MOCK-26" })
  @IsString()
  @IsOptional()
  accessCode?: string;

  @ApiPropertyOptional({ description: "Maximum tab switches allowed before auto-disqualification", default: 3 })
  @IsInt()
  @Min(0)
  @Max(20)
  @IsOptional()
  maxTabViolations?: number;

  @ApiPropertyOptional({ description: "Randomize question order for each candidate", default: true })
  @IsBoolean()
  @IsOptional()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({ description: "Randomize choice options for MCQ questions", default: true })
  @IsBoolean()
  @IsOptional()
  shuffleChoices?: boolean;

  @ApiPropertyOptional({ description: "Display result slip immediately after submission", default: true })
  @IsBoolean()
  @IsOptional()
  showResultAfter?: boolean;

  @ApiPropertyOptional({ description: "Scheduled start ISO timestamp" })
  @IsOptional()
  startsAt?: string;

  @ApiPropertyOptional({ description: "Scheduled deadline ISO timestamp" })
  @IsOptional()
  endsAt?: string;
}

export class UpdateExamDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Max(360)
  @IsOptional()
  durationMins?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  @IsOptional()
  maxTabViolations?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  shuffleChoices?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  showResultAfter?: boolean;
}

export class AttachQuestionsDto {
  @ApiProperty({ description: "Array of question IDs to attach", type: [String] })
  @IsArray()
  @IsString({ each: true })
  questionIds!: string[];
}
