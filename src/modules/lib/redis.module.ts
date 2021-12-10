import Redis from 'ioredis';
import Redlock from 'redlock';
import { promisify } from 'util';
import config from 'common/config';
import { IRedisLockOptions, RedisKey } from 'common/types';
import logger from './logger.module';

export const pubClient = new Redis(`redis://${config.redisHost}:${config.redisPort}`);
export const subClient = pubClient.duplicate();
const redlock = new Redlock([pubClient], {
  driftFactor: 0.01, // multiplied by lock ttl to determine drift time
  retryCount: 10,
  retryDelay: 200, // time in ms
  retryJitter: 200, // time in ms
});

redlock.on('clientError', (error) => {
  console.error(error, typeof error);
});

const MODULE = 'REDIS';

const defaultLockOptions: IRedisLockOptions = {
  timeout: 20000,
  retries: 3,
  delay: 100,
};

pubClient.on('connect', async () => {
  initState();
  console.log('Redis Client connected');
});
pubClient.on('end', () => {
  console.log('Redis Client disconnected');
});
pubClient.on('error', (error) => {
  logger.error('Redis Client Init error', { MODULE, error });
});

function initState() {
  del(RedisKey.OnlineUsers);
}

export function get(key: string, callback: any): void | null {
  try {
    pubClient.get(key, (err, data) => callback(err, JSON.parse(data || null)));
  } catch (err) {
    callback(null);
  }
}

export function set(key: string, data: any): void | null {
  try {
    pubClient.set(key, JSON.stringify(data || null));
  } catch (err) {
    return null;
  }
}

export async function del(payload: string | string[]): Promise<void | null> {
  try {
    let keys = payload;
    if (typeof payload === 'string') {
      if (keys.includes('*')) {
        keys = await this.keysAsync(payload);
      } else {
        keys = [payload];
      }
    }

    if (keys.length) {
      pubClient.del(keys as string[]);
    }
  } catch (err) {
    return null;
  }
}

export function keys(pattern: string, callback: any): void | null {
  try {
    pubClient.keys(pattern, callback);
  } catch (err) {
    callback(null);
  }
}

export function hget(key: string, field: string, callback: any): void | null {
  try {
    pubClient.hget(key, field, (err, data) => {
      callback(err, JSON.parse(data || null));
    });
  } catch (err) {
    callback(null);
  }
}

export function hmset(key: string, data: any): void | null {
  try {
    const keys = Object.keys(data).reduce((arr, v) => {
      if (data[v] === undefined) {
        return arr;
      }

      return arr.concat(v, JSON.stringify(data[v]));
    }, []);
    pubClient.hmset(key, ...keys);
  } catch (err) {
    return null;
  }
}

export function hmget(key: string, subKeys: string[], callback: any): void | null {
  try {
    pubClient.hmget(key, ...subKeys, ((err: Error, data: any) => {
      callback(
        err,
        data.map((v: any) => JSON.parse(v || null))
      );
    }) as any);
  } catch (err) {
    callback(null);
  }
}

export function publish(key: string, data: any): void {
  pubClient.publish(key, JSON.stringify(data));
}

export function subscribe(key: string, msgHandler: any, scbHandler?: any): Redis.Redis {
  subClient.subscribe(key);

  subClient.on('message', (_key, message) => {
    msgHandler(JSON.parse(message));
  });

  if (scbHandler) {
    subClient.on('subscribe', scbHandler);
  }

  return subClient;
}

export function numsub(channels: string[] = [], handler: any) {
  // Skip typing check as @typings/ioredis is missing pubsub support
  (pubClient as any).pubsub('NUMSUB', ...channels, (err: Error, data: any) => {
    if (err) {
      return handler(err);
    }

    const result: any = {};
    for (let i = 0; i < data.length; i += 2) {
      result[data[i]] = data[i + 1];
    }
    handler(null, result);
  });
}

export function channels(handler: any) {
  // Skip typing check as @typings/ioredis is missing pubsub support
  (pubClient as any).pubsub('CHANNELS', (err: Error, data: any) => {
    if (err) {
      return handler(err);
    }
    handler(null, data);
  });
}

export async function takeLock(lockKey: string, timeout = 5000) {
  try {
    await redlock.acquire([lockKey], timeout);

    return redlock;
  } catch (error) {
    console.log(error);
    // lock failed
    return null;
  }
}

export function subKey(key: RedisKey, keyValue: string): string {
  return `${key}_${keyValue}`;
}

export const numsubAsync = promisify(numsub).bind(this);
export const channelsAsync = promisify(channels).bind(this);
export const getAsync = promisify(get).bind(this);
export const hgetAsync = promisify(hget).bind(this);
export const hmgetAsync = promisify(hmget).bind(this);
export const keysAsync = promisify(keys).bind(this);
export const expire = promisify(pubClient.expire).bind(pubClient);
export const ttl = promisify(pubClient.ttl).bind(pubClient);
export const incr = promisify(pubClient.incr).bind(pubClient);
export const incrby = promisify(pubClient.incrby).bind(pubClient);
export const hincrby = promisify(pubClient.hincrby).bind(pubClient);
export const decr = promisify(pubClient.decr).bind(pubClient);
export const decrby = promisify(pubClient.decrby).bind(pubClient);
export const sadd = promisify(pubClient.sadd).bind(pubClient);
export const smembers = promisify(pubClient.smembers).bind(pubClient);
export const scard = promisify(pubClient.scard).bind(pubClient);
export const srem = promisify(pubClient.srem).bind(pubClient);
export const sismember = promisify(pubClient.sismember).bind(pubClient);
