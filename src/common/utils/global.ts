import { NextFunction, Request, Response } from 'express';
import { LeanDocument, Types } from 'mongoose';
import formidable from 'formidable';
import joi from 'joi';
import { default as FormData } from 'form-data';
import { DateTime } from 'luxon';
import { IJoi, IRequest, StatusCode } from 'common/types';
import CustomError from 'common/errors/custom-error';
import { ISessionDocument, IWorkingHour } from 'models/types';
import Config from 'common/config';
import { createHash } from 'crypto';

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

export function cleanSeconds(date: DateTime) {
  return date.set({ second: 0, millisecond: 0 });
}

/**
 * Get valid working hours in consideration of available hours of target user, along with time filter
 *
 * @param targetTimezone   Target user's timezone
 * @param startTime  Start time of filter range
 * @param endTime  End time of filter range
 * @param availableHours   Target user's available working hours - user is considered available all day when it is empty
 * @param sessions   sessions within start time and endtime range
 *
 */
export function checkWithinWorkingHours(
  startTime: Date | DateTime,
  endTime: Date | DateTime,
  availableHours: IWorkingHour[],
  sessions: LeanDocument<ISessionDocument>[] = []
) {
  const nowDateTime = DateTime.now();
  const isFullyAvailable = !availableHours;
  if (startTime >= endTime) {
    throw createError(StatusCode.BAD_REQUEST, 'End time should be later than start time');
  }
  if (availableHours?.length === 0) {
    return [];
  }

  // check meeting duration based on user subscription package
  let startHour = startTime instanceof Date ? DateTime.fromJSDate(startTime) : startTime;
  let endHour = (endTime instanceof Date ? DateTime.fromJSDate(endTime) : endTime).minus(
    MEETING_DURATION
  );
  const sourceTimezone = startHour.zone;
  if (startHour < nowDateTime) {
    startHour = nowDateTime.setZone(sourceTimezone);
  }

  // minute modification
  startHour = cleanSeconds(
    startHour.set({
      minute:
        startHour.get('minute') % MEETING_DURATION.minutes > 0
          ? Math.floor(startHour.get('minute') / MEETING_DURATION.minutes + 1) *
            MEETING_DURATION.minutes
          : startHour.get('minute'),
    })
  );
  endHour = cleanSeconds(
    endHour.set({
      minute:
        Math.floor(endHour.get('minute') / MEETING_DURATION.minutes) * MEETING_DURATION.minutes,
    })
  );

  let ahIndex = 0;
  let resultPerDay = [];
  const result = [];

  // clone op
  let op = DateTime.fromMillis(startHour.toMillis()).setZone(sourceTimezone);
  const ahDateTimes: { start?: DateTime; end?: DateTime } = {};

  if (!isFullyAvailable) {
    ahDateTimes.start = DateTime.fromJSDate(availableHours[ahIndex].start);
    ahDateTimes.end = DateTime.fromJSDate(availableHours[ahIndex].end);

    op = cleanSeconds(
      op.set({
        year: ahDateTimes.start.year,
        month: ahDateTimes.start.month,
        day: ahDateTimes.start.day,
        hour: ahDateTimes.start.hour,
        minute: 0,
      })
    );
  }

  do {
    let isAvailableHoursFree = false;
    const meetingDateTimes = {
      start: op,
      end: op.plus(MEETING_DURATION),
    };

    if (isFullyAvailable) {
      isAvailableHoursFree = true;
    } else if (
      ahDateTimes.start <= op &&
      op <= ahDateTimes.end &&
      !ahDateTimes.start.equals(ahDateTimes.end)
    ) {
      // just skip check if it is already true
      isAvailableHoursFree =
        ahDateTimes.start <= meetingDateTimes.start && meetingDateTimes.end <= ahDateTimes.end;
    }

    // check conflicts with sessions
    const isSessionFree = sessions.every((session) => {
      // convert appointment time into requester's timezone, to sync date frame
      const sessionStart = DateTime.fromJSDate(session.startTime as Date).setZone(sourceTimezone);
      const sessionEnd = DateTime.fromJSDate(session.endTime as Date).setZone(sourceTimezone);

      // skip appointments in other day
      if (!sessionStart.hasSame(meetingDateTimes.start, 'day')) {
        return true;
      }

      return sessionStart >= meetingDateTimes.end || sessionEnd <= meetingDateTimes.start;
    });

    if (isAvailableHoursFree && isSessionFree) {
      resultPerDay.push({
        start: meetingDateTimes.start.toISO({ includeOffset: true }),
        end: meetingDateTimes.end.toISO({ includeOffset: true }),
      });
    }

    const nextOp = op.plus(MEETING_DURATION);
    if (!nextOp.hasSame(op, 'day')) {
      // push to results for this day
      if (resultPerDay.length > 0) {
        result.push({
          date: op.setZone(sourceTimezone).toISO({ includeOffset: true }),
          hours: resultPerDay,
        });

        resultPerDay = [];
      }

      // use next day if available hour check is skipped
      if (!isFullyAvailable) {
        do {
          ahIndex += 1;
          if (!availableHours[ahIndex]) {
            break;
          }

          ahDateTimes.start = cleanSeconds(DateTime.fromJSDate(availableHours[ahIndex].start));
          ahDateTimes.end = cleanSeconds(DateTime.fromJSDate(availableHours[ahIndex].end));
        } while (ahDateTimes.end < nowDateTime);

        if (availableHours[ahIndex]) {
          op = cleanSeconds(
            op.set({
              year: ahDateTimes.start.year,
              month: ahDateTimes.start.month,
              day: ahDateTimes.start.day,
              hour: ahDateTimes.start.hour,
              minute: 0,
            })
          );

          continue;
        } else {
          break;
        }
      }
    }

    op = nextOp;
  } while (op <= endHour);

  // last day consideration
  if (resultPerDay.length > 0) {
    result.push({
      date: op.setZone(sourceTimezone).toISO({ includeOffset: true }),
      hours: resultPerDay,
    });
  }

  return result;
}

export function formidablePromise(
  req: IRequest,
  opts: any = {}
): Promise<{ fields: { [key in string]: any }; files: formidable.Files }> {
  return new Promise(function (resolve, reject) {
    var form = new formidable.IncomingForm(opts);
    form.parse(req, function (err, fields, files) {
      if (err) {
        return reject(err);
      }

      resolve({ fields: fields, files: files });
    });
  });
}

export function verifyPassword (userPassword: string, dbPassword: string) {
  const pwdHash = createHash('sha256', Config.pwdSecret).update(userPassword).digest('base64');
  // console.log('this.password', this.password);
  console.log('passed password', userPassword);
  return dbPassword === pwdHash;
};
