const http = require('http');

const { getDate } = require('./helpers');

module.exports = async resources => {
    const { configHelper, logger, redis } = resources;
    const { add } = redis;
    const log = await logger.getLogger('server');
    const { port, hostname } = await configHelper.getServerConnectionOpts();
    let server;

    async function start() {
        if (!server) {
            server = http.createServer((req, res) => handler(req, res));
            await new Promise((resolve, reject) => {
                let listenCallback;
                const errorHandler = err => {
                    reject(`Cloud not start HTTPS server due to an underlying error ${err}`);
                };
                listenCallback = () => {
                    log(`Started listening port ${port}`);
                    server.removeListener('error', errorHandler);
                    resolve();
                };
                server.on('error', errorHandler);
                server.listen(port, hostname, listenCallback);
            });
        }
        return Promise.resolve();
    }
    async function destroy() {
        if (server && server.close) {
            return new Promise(resolve => {
                server.close(err => {
                        if (err) {
                            log(err);
                        }
                        resolve();
                    }
                );
            });
        }
        return Promise.resolve();
    }
    async function handler(req, res) {
        let ok = 'OK\n';
        try {
            const requestBuffer = await new Promise((resolve, reject) => {
                const requestDataChunks = [];
                req.on('data', chunk => requestDataChunks.push(chunk));
                req.on('error', err => reject(err));
                req.on('end', () => resolve(Buffer.concat(requestDataChunks)));
            });
            const request = requestBuffer.toString();
            const { time, message } = JSON.parse(request);
            if (time && message) {
                await add(message, getDate(time).getTime() - getDate().getTime());
            } else {
                log('received bad request:', request);
                ok = 'BAD_REQUEST\n';
            }
        } catch (err) {
            log(err);
            ok = 'ERROR\n';
        }
        res.end(ok);
    }
    return {
        start,
        destroy
    }
};