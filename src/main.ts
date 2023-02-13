import config from 'config';
import ConsoleLogger from './infrastructure/consoleLogger';
import { ServerOptions } from './infrastructure/serverOptions';

import router from './router';
import Server from './server';

// Main starting point of the application
class Main {
    private server: Server;

    public constructor() {
        const serverOptions: ServerOptions = config.get('server');
        const logger = new ConsoleLogger();
        this.server = new Server(logger, router, serverOptions);
    }

    public async start() {
        await this.server.start();
    }

    public stop() {
        this.server.stop();
    }
}
const main = new Main();
(async function startApplication() {
    await main.start();
})();

export default main;
