const Redis = require('ioredis');
const uuid = require('uuid/v4');

const { getDate, getTime } = require('./helpers');

module.exports = async resources => {
    const { configHelper, logger, printToConsole } = resources;
    const log = await logger.getLogger('redis');
    const { delayedQueueName, acquireLockTimeout, acquireLockDelay, watchDelay, lockPrefix } = await configHelper.getRedisOpts();
    let redis;
    let currentDate;
    let halt = false;

    async function start() {
        currentDate = getDate();
        const connectionOpts = await configHelper.getRedisConnectionOpts();
        if (!redis) {
            try {
                redis = new Redis(connectionOpts);
                await watch();
            } catch (err) {
                return Promise.reject(err);
            }
        }
        return Promise.resolve();
    }
    async function add(data, delay) {
        const id = uuid();
        const item = { id, data };
        const now = getDate().getTime();
        await redis.zadd(delayedQueueName, now + delay, JSON.stringify(item));
    }
    async function destroy() {
        halt = true;
        if (redis) {
            redis.quit();
        }
        return Promise.resolve();
    }
    async function watch() {
        let items;
        try {
            items = await redis.zrange(delayedQueueName, 0, 0, 'withscores');
        } catch (err) {
            log(err);
            throw err;
        }
        if (items && items[1] && items[1] <= getDate().getTime()){
            const { id, data } = JSON.parse(items[0]);
            const lockId = await acquireLock(id, acquireLockTimeout, acquireLockDelay);
            if (lockId) {
                printToConsole(data);
                await redis.zrem(delayedQueueName, items[0]);
                await releaseLock(lockId, id);
            }
        } else {
            if (getTime() > currentDate.getTime() + 30000) {
                // log(`${getDate()}: still working`);
                currentDate = getDate();
            }
        }
        if (!halt) {
            return setTimeout(watch, watchDelay);
        }
    }
    async function acquireLock(id, timeout, delay) {
        const lockId = uuid();
        const lockName = `${lockPrefix}${id}`;
        const end = getTime() + timeout;
        while (getTime() < end) {
            const isLocked = await redis.setnx(lockName, id);
            if (isLocked) {
                return lockId;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        return false;
    }
    async function releaseLock(lockId, id) {
        const pipeline = redis.pipeline();
        const lockName = `${lockPrefix}${id}`;
        while (true) {
            try {
                pipeline.watch(lockName);
                const savedId = await pipeline.get(lockName);
                if (savedId === id) {
                    pipeline.multi();
                    await pipeline.delete(lockName);
                    await pipeline.exec();
                    return true;
                }
                pipeline.unwatch();
                return false;
            } catch (err) {
                log(err);
            }
        }
    }
    return {
        start,
        destroy,
        add
    }
};
