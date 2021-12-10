import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import joi from 'joi';
import { default as FormData } from 'form-data';
import { IJoi, IRequest, StatusCode } from 'common/types';
import CustomError from 'common/errors/custom-error';

const MEETING_DURATION = {
  minutes: 30,
};

export function createError(status: number, message?: string): CustomError {
  let errorName: string = '';
  let errorMsg: string = message;
  let errorStatus: number = status;

  if (typeof status === 'string') {
    errorStatus = StatusCode.INTERNAL_SERVER_ERROR;
    errorMsg = status;
  }

  switch (errorStatus) {
    case StatusCode.UNAUTHORIZED:
      errorName = 'UnauthorizedError';
      errorMsg = errorMsg || 'Authentication required';

      break;

    case StatusCode.BAD_REQUEST:
      errorName = 'BadRequest';
      errorMsg = errorMsg || 'Invalid request';

      break;

    case StatusCode.FORBIDDEN:
      errorName = 'BadPermission';
      errorMsg = errorMsg || 'Permission denied';

      break;

    case StatusCode.UNPROCESSABLE_ENTITY:
      errorName = 'NotFound';
      errorMsg = errorMsg || 'Entry not found';

      break;

    default:
      errorName = 'Error';
      errorStatus = StatusCode.INTERNAL_SERVER_ERROR;
      errorMsg = errorMsg || 'An error occurred';

      break;
  }

  const error = new CustomError(errorStatus, errorMsg);

  error.name = errorName;
  error.status = errorStatus;
  error.message = errorMsg;

  return error;
}

export function createController(handler: Function) {
  return async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const result = await handler(req, res, next);
      if (!req.redirected) {
        next(result || 'OK');
      }
    } catch (err) {
      next(CustomError.fromError(err));
    }
  };
}

/**
 * Wait for given time
 *
 * @param time time to wait in milisecond
 */
export function asyncWait(time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time);
  });
}

/**
 * Get user ip from request object
 *
 * @param req request object
 */
export function getIpFromRequest(req: Request): string {
  const ipStr = (req.headers['x-forwarded-for'] || req.connection.remoteAddress) as string;
  let ip = ipStr.split(':').pop();

  if (ip.indexOf(',') !== -1) {
    ip = ip.split(',')[0].trim();
  }
  return ip;
}

/**
 * Check if id is valid mongoose id
 *
 * @param id mongoose id
 */
export function isValidId(id: string): boolean {
  return Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id;
}

export const REGEXS = {
  email:
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  password: /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/,
};

export const Joi: IJoi = joi.extend(require('@joi/date')) as unknown as IJoi;

function buildFormData(formData: FormData, data: any, parentKey?: string) {
  if (data && typeof data === 'object' && !(data instanceof Date)) {
    Object.keys(data).forEach((key) => {
      buildFormData(formData, data[key], parentKey ? `${parentKey}[${key}]` : key);
    });
  } else {
    const value = data == null ? '' : data;

    formData.append(parentKey, value);
  }
}

export function jsonToFormData(data: any): FormData {
  const formData = new FormData();

  buildFormData(formData, data);

  return formData;
}
