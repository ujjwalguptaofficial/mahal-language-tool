import * as winston from "winston";
import "winston-daily-rotate-file";
export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {
        service: 'user-service'
    },
    transports: [
        // - Write to all logs with level `debug` and below to `all.log` 
        // - Write all logs error (and below) to `error.log`.

        new winston.transports.DailyRotateFile({
            datePattern: 'DD-MM-YYYY',
            filename: `logs/error.log`,
            level: 'error'
        }),
        new winston.transports.DailyRotateFile({
            datePattern: 'DD-MM-YYYY',
            filename: `logs/all.log`,
            level: 'debug'
        })
    ]
});
logger.exceptions.handle(
    new winston.transports.DailyRotateFile({
        datePattern: 'DD-MM-YYYY',
        filename: `logs/exception.log`,
        level: 'error'
    }),
    new winston.transports.Console({ handleExceptions: true })
);
logger.exitOnError = false;
// If we're not in production then log to the `console`  
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}