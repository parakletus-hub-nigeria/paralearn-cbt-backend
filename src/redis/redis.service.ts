import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("RedisService");
  private memoryCache: Map<string, any> = new Map();
  private isRedisAvailable = false;
  private client: any = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const host = this.config.get<string>("REDIS_HOST", "localhost");
    const port = this.config.get<number>("REDIS_PORT", 6379);

    try {
      // Dynamic import of ioredis to ensure resilient startup
      const Redis = (await import("ioredis")).default;
      this.client = new Redis({
        host,
        port,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn("Redis host unreachable. Falling back to in-memory buffering.");
            return null; // Stop retrying, use fallback
          }
          return 500;
        },
      });

      this.client.on("connect", () => {
        this.isRedisAvailable = true;
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      });

      this.client.on("error", (err: any) => {
        this.isRedisAvailable = false;
      });
    } catch (e) {
      this.logger.warn("ioredis not initialized. Using in-memory fallback cache.");
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }

  // ── Sub-millisecond Timer Synchronization ────────────────────────────────
  async startTimer(attemptId: string, durationMins: number): Promise<{ deadline: string; remainingSecs: number }> {
    const deadline = new Date(Date.now() + durationMins * 60 * 1000).toISOString();
    const durationSecs = durationMins * 60;

    if (this.isRedisAvailable && this.client) {
      const key = `attempt:${attemptId}:timer`;
      await this.client.hset(key, "deadline", deadline, "durationSecs", durationSecs);
      await this.client.expire(key, durationSecs + 3600); // 1hr grace
    } else {
      this.memoryCache.set(`timer:${attemptId}`, { deadline, durationSecs });
    }

    return { deadline, remainingSecs: durationSecs };
  }

  async getRemainingSeconds(attemptId: string): Promise<number> {
    let deadlineStr: string | null = null;

    if (this.isRedisAvailable && this.client) {
      deadlineStr = await this.client.hget(`attempt:${attemptId}:timer`, "deadline");
    } else {
      const stored = this.memoryCache.get(`timer:${attemptId}`);
      deadlineStr = stored?.deadline || null;
    }

    if (!deadlineStr) return 0;
    const diff = Math.floor((new Date(deadlineStr).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  }

  // ── Ephemeral Answer Buffering (Zero-DB writes during exam) ───────────────
  async bufferAnswer(attemptId: string, questionId: string, value: any): Promise<void> {
    const stringified = JSON.stringify(value);

    if (this.isRedisAvailable && this.client) {
      const key = `attempt:${attemptId}:answers`;
      await this.client.hset(key, questionId, stringified);
    } else {
      const mapKey = `answers:${attemptId}`;
      const existing = this.memoryCache.get(mapKey) || {};
      existing[questionId] = stringified;
      this.memoryCache.set(mapKey, existing);
    }
  }

  async getBufferedAnswers(attemptId: string): Promise<Record<string, any>> {
    let raw: Record<string, string> = {};

    if (this.isRedisAvailable && this.client) {
      raw = (await this.client.hgetall(`attempt:${attemptId}:answers`)) || {};
    } else {
      raw = this.memoryCache.get(`answers:${attemptId}`) || {};
    }

    const parsed: Record<string, any> = {};
    for (const [qId, str] of Object.entries(raw)) {
      try {
        parsed[qId] = JSON.parse(str as string);
      } catch {
        parsed[qId] = str;
      }
    }
    return parsed;
  }

  // ── Malpractice Violation Tracking ───────────────────────────────────────
  async incrementViolations(attemptId: string): Promise<number> {
    if (this.isRedisAvailable && this.client) {
      const key = `attempt:${attemptId}:violations`;
      const count = await this.client.incr(key);
      return count;
    } else {
      const mapKey = `violations:${attemptId}`;
      const count = (this.memoryCache.get(mapKey) || 0) + 1;
      this.memoryCache.set(mapKey, count);
      return count;
    }
  }

  async getViolations(attemptId: string): Promise<number> {
    if (this.isRedisAvailable && this.client) {
      const count = await this.client.get(`attempt:${attemptId}:violations`);
      return parseInt(count || "0", 10);
    } else {
      return this.memoryCache.get(`violations:${attemptId}`) || 0;
    }
  }
}
