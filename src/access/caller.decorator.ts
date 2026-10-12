import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Who is calling:
 *  - "service": the ParaLearn web app's server, which has already checked the
 *    examiner's session and workspace ownership.
 *  - "workspace": an external integration using one workspace's API key.
 */
export type CbtCaller =
  | { kind: "service" }
  | { kind: "workspace"; workspaceId: string };

export const Caller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CbtCaller =>
    ctx.switchToHttp().getRequest().cbtCaller,
);
