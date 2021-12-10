import { ErrorModule, StatusCode } from 'common/types';
import logger from 'modules/lib/logger.module';

class CustomError extends Error {
  public status: number;
  public message: string;
  public module: ErrorModule;

  constructor(status: number, message: string, module?: ErrorModule) {
    super(message);
    this.status = status;
    this.message = message;
    this.module = module;
  }

  public static fromError(error: any) {
    if (!error.status) {
      logger.log(error.message, { stack: error.stack });
      console.log('\n');
    }
    return new CustomError(error.status || StatusCode.INTERNAL_SERVER_ERROR, error.message);
  }
}

export default CustomError;
