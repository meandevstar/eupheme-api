import { NextFunction, Response } from 'express';
import { isError } from 'joi';
import CustomError from 'common/errors/custom-error';
import { IApiResponse, IRequest, StatusCode } from 'common/types';
import logger from 'modules/lib/logger.module';

function responseHandler(data: CustomError | any, req: IRequest, res: Response, next: NextFunction) {
  let _status: StatusCode;
  let _resKey: string;
  let _data: any;
  let _message: string;

  if (data instanceof CustomError) {
    // Custom error
    _status = data.status || StatusCode.INTERNAL_SERVER_ERROR;
    _message = data.message || 'Server Error';
    _resKey = 'error';
  } else if (isError(data)) {
    // Joi validation error
    logger.log(data.details[0]?.message, { module: (data as any).module, error: data });

    _status = StatusCode.BAD_REQUEST;
    _message = data.details[0]?.message;
    _resKey = 'error';
  } else if (data instanceof Error) {
    // fallback error case

    _status = StatusCode.BAD_REQUEST;
    _message = data.message;
    _resKey = 'error';

    logger.log(_message, { stack: data.stack });
    console.log('\n');
  } else {
    if (data instanceof Object === true) {
      if ('message' in data === true) {
        _message = data.message;
        delete data.message;
      }
      // unwind if only data field left
      if ('data' in data === true && Object.keys(data).length === 1) {
        _data = data.data;
      } else {
        _data = data;
      }
    } else {
      _data = data;
    }

    _message = _message || 'OK';
    _status = StatusCode.OK;
    _resKey = 'data';
  }

  const responseData: IApiResponse = {
    message: _message,
    [_resKey]: _data,
  };

  return res.status(_status).json(responseData);
}

export default responseHandler;
