import { Redis } from "@upstash/redis";

let redisSingleton: Redis | null = null;

export function redis() {
  if (!redisSingleton) {
    redisSingleton = Redis.fromEnv();
  }

  return redisSingleton;
}
