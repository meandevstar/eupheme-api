import { Response, NextFunction } from 'express';
import { createError } from 'common/utils';
import { IRequest, StatusCode } from 'common/types';
import { UserType } from 'models/types';

export default function(roles: UserType | UserType[]) {
  return (req: IRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(createError(StatusCode.BAD_REQUEST, 'Authorization is required'));
    }

    const { type } = req.auth;

    if (roles instanceof Array === false) {
      roles = [roles as UserType];
    }

    if (roles.indexOf(type) === -1) {
      next(createError(StatusCode.FORBIDDEN, "You don't have permission"));
    } else {
      next();
    }
  };
}
