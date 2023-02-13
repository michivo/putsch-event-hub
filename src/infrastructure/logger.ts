// logger interface for providing Logging functionality
export default interface Logger {
    info: (message: string) => number;
    error: (error: string | Error) => number;
}
