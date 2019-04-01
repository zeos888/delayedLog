const redisFactory = require('./redis');

module.exports = async () => {
    const resources = {};
    const config = require('../docs/example-config');
    resources.configHelper = {
        getRedisOpts: () => Promise.resolve(config.redis.opts),
        getRedisConnectionOpts: () => Promise.resolve(config.redis.connection),
        getServerConnectionOpts: () => Promise.resolve(config.server.connection)
    };
    resources.logger = {
        getLogger: loggerName => Promise.resolve((...text) => console.log(`${loggerName}: ${text}`))
    };
    resources.printToConsole = text => console.log(text);
    resources.redis = await redisFactory(resources);
    await resources.redis.start();
    resources.destroy = async () => resources.redis.destroy();
    return Promise.resolve(resources);
};
