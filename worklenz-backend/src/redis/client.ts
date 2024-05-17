import * as redis from "redis";

const client = redis.createClient();

const initRedis = async () => {
  client.on("connect", () => console.log("Redis Client Connected"));
  client.on("error", err => console.log("Redis Client Error", err));
  await client.connect();
};

export {initRedis, client as redisClient};
