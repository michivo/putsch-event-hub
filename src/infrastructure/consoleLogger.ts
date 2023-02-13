import Logger from './logger';

// Implementation of the Logger interface for logging onto the console
class ConsoleLogger implements Logger {
    active = true;

    info = (message: string): number => {
        if (this.active) { console.log(message); }
        return 0;
    }

    error = (error: string | Error): number => {
        if (this.active) { console.log(error); }
        return 0;
    }
}

export default ConsoleLogger;
