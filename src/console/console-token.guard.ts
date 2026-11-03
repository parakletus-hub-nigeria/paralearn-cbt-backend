import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

export const CONSOLE_TOKEN_HEADER = 'x-console-token';

/**
 * Authenticates the Parakletus admin console (admin.parakletushub.com), a
 * server-to-server caller, by a shared token in ADMIN_CONSOLE_TOKEN.
 * Fails closed: if the env var is missing or short, every request is refused.
 */
@Injectable()
export class ConsoleTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_CONSOLE_TOKEN ?? '';
    if (expected.length < 32) {
      throw new ServiceUnavailableException('Console access is not configured');
    }

    const request = context.switchToHttp().getRequest();
    const given = request.headers[CONSOLE_TOKEN_HEADER];
    if (typeof given !== 'string' || !given) {
      throw new UnauthorizedException('Console token required');
    }

    // Hash both sides so the comparison is constant-time regardless of length.
    const a = createHash('sha256').update(given).digest();
    const b = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid console token');
    }
    return true;
  }
}
