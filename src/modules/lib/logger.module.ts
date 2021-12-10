import { createLogger, format, transports, Logger, LoggerOptions } from 'winston';
import config from 'common/config';

require('winston-mongodb').Mongo;

const metaDataKeyName = 'meta';
const defaultContextName = 'DEFAULT';

class LogModule {
  contextName: string;
  logger: Logger;

  constructor() {
    this.contextName = defaultContextName;
    this.logger = createLogger();

    const logTransportConsole = new transports.Console({
      handleExceptions: true,
      format: format.combine(format.colorize(), format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.simple()),
    });
    this.logger.configure({
      transports: [logTransportConsole],
      exitOnError: false,
    });

    if (process.env.TEST_CALL_TOKEN || process.env.NODE_ENV !== 'production') {
      return;
    }

    const logTransportMongoDB = new (transports as any)['MongoDB']({
      db: config.logDbUrl,
      handleExceptions: true,
      metaKey: metaDataKeyName,
      collection: 'error_log',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    });

    this.logger.add(logTransportMongoDB);
  }

  configure(configuration: LoggerOptions, contextName: string) {
    this.logger.configure(configuration);
    this.contextName = contextName || this.contextName;
  }

  log(message: string, meta?: any) {
    this.logger.log({
      level: 'info',
      message,
      meta: { context: this.contextName, ...meta },
    });
  }

  info(message: string, meta?: any) {
    this.logger.log({
      level: 'info',
      message,
      meta: { context: this.contextName, ...meta },
    });
  }

  warn(message: string, meta?: any) {
    this.logger.log({
      level: 'warn',
      message,
      meta: { context: this.contextName, ...meta },
    });
  }

  error(message: string, metaData: any = {}) {
    const { error, ...otherMeta } = metaData;
    let meta = { context: this.contextName, ...otherMeta };
    if (error) {
      meta = Object.assign(meta, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    this.logger.log({
      level: 'error',
      message,
      meta,
    });
  }
}

const logger = new LogModule();

export default logger;
