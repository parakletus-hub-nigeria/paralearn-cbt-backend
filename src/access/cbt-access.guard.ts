import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { CbtCaller } from "./caller.decorator";

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Every route except candidate exam-taking requires either the internal
 * service key or a workspace API key.
 */
@Injectable()
export class CbtAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();

    const serviceSecret = this.config.get<string>("CBT_SERVICE_SECRET")?.trim();
    const serviceKey = String(req.headers["x-cbt-service-key"] || "");
    if (serviceSecret && serviceKey && safeEqual(serviceKey, serviceSecret)) {
      req.cbtCaller = { kind: "service" } satisfies CbtCaller;
      return true;
    }

    const auth = String(req.headers["authorization"] || "");
    const apiKey = auth.startsWith("Bearer ")
      ? auth.slice(7).trim()
      : String(req.headers["x-api-key"] || "").trim();
    if (apiKey) {
      const workspace = await this.prisma.cbtWorkspace.findUnique({
        where: { apiKey },
        select: { id: true },
      });
      if (workspace) {
        req.cbtCaller = { kind: "workspace", workspaceId: workspace.id } satisfies CbtCaller;
        return true;
      }
    }

    throw new UnauthorizedException(
      "A valid API key is required: Authorization: Bearer <API_KEY>.",
    );
  }
}
