const assert = require('assert');
const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const redisFactory = require('../lib/redis');

const fakeResources = {
    configHelper: {
        getRedisOpts: () => {
            return{
                delayedQueueName: 'delayedQueueName',
                acquireLockTimeout: 'acquireLockTimeout',
                acquireLockDelay: 'acquireLockDelay',
                watchDelay: 'watchDelay',
                lockPrefix: 'lockPrefix',
            };
        },
    },
    logger: {
        getLogger: () => {},
    },
    printToConsole: {},
};

describe('redis unit tests', () => {
    it('should expose correct interface', async () => {
        const redis = await redisFactory(fakeResources);
        assert.strictEqual(_.isFunction(redis.start), true);
        assert.strictEqual(_.isFunction(redis.add), true);
        assert.strictEqual(_.isFunction(redis.destroy), true);
    });
});