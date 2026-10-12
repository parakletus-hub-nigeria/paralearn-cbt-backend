import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "cbt:isPublic";

/** Candidate-facing routes that need no examiner credentials */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
