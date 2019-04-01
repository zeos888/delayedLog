const resourcesFactory = require('./lib/resources');
const serverFactory = require('./lib/server');

['SIGTERM', 'SIGINT', 'unhandledRejection'].forEach(signal => process.on(signal, async err => {
    if (err) {
        console.error(err);
    }
    await gracefulShutdown(signal)
}));

let server;
let resources;

async function start() {
    resources = await resourcesFactory();
    server = await serverFactory(resources);
    await server.start();
}

async function gracefulShutdown(signal) {
    console.log(`Got ${signal}, shutting down`);
    if (server) {
        await server.destroy();
    }
    if (resources){
        await resources.destroy();
    }
    process.exit(0);
}

start().then(() => console.log('Started')).catch(err => gracefulShutdown(err.message));
