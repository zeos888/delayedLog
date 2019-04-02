const assert = require('assert');
const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

const redisFactory = require('../lib/redis');

let printed = [];
const fakeResources = {
    configHelper: {
        getRedisOpts: () => {
            return{
                delayedQueueName: 'delayedQueueName',
                acquireLockTimeout: 500,
                acquireLockDelay: 5,
                watchDelay: 5,
                lockPrefix: 'lockPrefix',
            };
        },
        getRedisConnectionOpts: () => {},
    },
    logger: {
        getLogger: () => (...msg) => {console.log(msg.join(' '))},
    },
    printToConsole: msg => printed.push(msg),
};

let savedId;
class PipeLine {
    constructor() {
        this.locks = {};
        this.deletedLocks = {};
        this.watchCalled = [];
        this.unwatched = [];
        this.multiCalledCount = 0;
    }
    watch(lockName) {
        this.watchCalled.push(lockName);
    }
    get(lockName) {
        return this.locks[lockName];
    }
    multi() {
        this.multiCalledCount++;
    }
    delete(lockName) {
        this.toExec = () => {
            this.deletedLocks[lockName] = this.locks[lockName];
            delete this.locks[lockName];
        }
    }
    exec() {
        return this.toExec();
    }
    unwatch() {
        const lockName = this.watchCalled.pop();
        this.unwatched.push(lockName);
    }
}
let fakeRedis;
class FakeRedis {
    constructor() {
        this.pipes = new PipeLine();
        this.queues = {};
        this.deleted = {};
        fakeRedis = this;
    }
    zrange(queueName) {
        if (!this.queues[queueName]) {
            this.queues[queueName] = {};
        }
        const item = Object.keys(this.queues[queueName])[0];
        const time = this.queues[queueName][item];
        return [item, time];
    }
    quit() {

    }
    setnx(lockName, id) {
        if (this.pipes.locks[lockName]) {
            return false;
        }
        this.pipes.locks[lockName] = id;
        return true;
    }
    zadd(queueName, time, item) {
        if (!this.queues[queueName]) {
            this.queues[queueName] = {};
        }
        this.queues[queueName][item] = time;
    }
    zrem(queueName, item) {
        if(!this.deleted[queueName]) {
            this.deleted[queueName] = {};
        }
        this.deleted[queueName][item] = this.queues[queueName][item];
        return delete this.queues[queueName][item];
    }
    pipeline() {
        return this.pipes;
    }
}
describe('redis unit tests', () => {
    const fakeNow = 1234567890;
    let clock;
    beforeEach(() => {
        printed = [];
        clock = sinon.useFakeTimers({ now: fakeNow, toFake: ['Date'] });
    });
    afterEach(() => {
        clock.restore();
    });
    it('should expose correct interface', async () => {
        const redis = await redisFactory(fakeResources);
        assert.strictEqual(_.isFunction(redis.start), true);
        assert.strictEqual(_.isFunction(redis.add), true);
        assert.strictEqual(_.isFunction(redis.destroy), true);
    });
    it('should start and run correctly', async () => {
        const redisFactoryProxyfied = proxyquire('../lib/redis', {
            'ioredis': FakeRedis,
            'uuid/v4': () => 1,
            noCallThru: true,
        });
        const redis = await redisFactoryProxyfied(fakeResources);
        await redis.start();
        try {
            //const timePromise = new Promise(resolve => setTimeout(resolve, 500));
            const item = { id: 1, data: 'test data' };
            await redis.add(item.data, 10);
            const { delayedQueueName } = fakeResources.configHelper.getRedisOpts();
            assert.deepStrictEqual(fakeRedis.queues[delayedQueueName][JSON.stringify(item)], fakeNow + 10);
            clock.tick(11);
            await new Promise(resolve => setTimeout(resolve, 20));
            const expectedBlank = {};
            expectedBlank[delayedQueueName] = {};
            assert.deepStrictEqual(fakeRedis.queues, expectedBlank);
            assert.deepStrictEqual(fakeRedis.deleted[delayedQueueName][JSON.stringify(item)], fakeNow + 10);
            assert.strictEqual(printed.length, 1);
            assert.strictEqual(printed[0], item.data);
            //await timePromise;
        } finally {
            await redis.destroy();
        }
    });
});