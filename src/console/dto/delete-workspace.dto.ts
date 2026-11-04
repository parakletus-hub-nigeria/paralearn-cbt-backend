import { IsString, MaxLength, MinLength } from "class-validator";

export class DeleteWorkspaceDto {
  /** Must equal the workspace's name (case-insensitive). */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  confirm!: string;
}
