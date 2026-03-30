
const disableLogs = false; //for regular logs

export enum Verbosity {
    NONE = 0,
    LOW = 10,
    MEDIUM = 20,
    HIGH = 30
}

export const verbosityConfig: Record<string, Verbosity> = {
    controller: Verbosity.HIGH,
    database: Verbosity.LOW,
    routes: Verbosity.MEDIUM,
    sse: Verbosity.MEDIUM,
    default: Verbosity.MEDIUM,
}

export function createLogger(module: string, logType: string) {
    return {
        log: disableLogs ? () => {} : (message: string, level: Verbosity = Verbosity.LOW) => {
            const moduleVerbosity = verbosityConfig[logType] ?? verbosityConfig.default;
            if (moduleVerbosity >= level) {
                console.log(`[${module}] ${message}`);
            }
        },
        //logging always enabled for critical errors
        criticalError: (message: string) => {
            console.error(`[${module}] ${message}`);
        } 
    };
}