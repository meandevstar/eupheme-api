import { Response, NextFunction } from 'express';
import { UserType, IAuthTokenPayload, UserStatus } from 'models/types';
import { StatusCode, IRequest } from 'common/types';
import { createError, isValidId } from 'common/utils';
import { verifyToken } from 'modules/auth.module';

export default async function authMiddleware(req: IRequest, res: Response, next: NextFunction) {
  let accessToken: string = req.get('Authorization');
  if (!accessToken) {
    return next(createError(StatusCode.UNAUTHORIZED, 'Authorization is required'));
  }
  accessToken = accessToken.split(' ').pop();

  let tokenParsed: IAuthTokenPayload;
  try {
    tokenParsed = await verifyToken<IAuthTokenPayload>(accessToken);
  } catch (error) {
    return next(createError(StatusCode.UNAUTHORIZED, 'Session expired'));
  }

  if (!isValidId(tokenParsed.id)) {
    return next(createError(StatusCode.BAD_REQUEST, 'User does not exists'));
  }

  const allUserTypes = Object.values(UserType);
  if (allUserTypes.indexOf(tokenParsed.type) === -1) {
    // this is not auth token
    return next(createError(StatusCode.BAD_REQUEST, 'Token is invalid'));
  }

  const { User } = req.context.conn;
  const user = await User.findById(tokenParsed.id);

  if (!user) {
    return next(createError(StatusCode.BAD_REQUEST, 'User does not exists'));
  }
  if (user.status === UserStatus.Disabled) {
    return next(createError(StatusCode.FORBIDDEN, 'You are banned'));
  }

  req.auth = tokenParsed;
  req.context.user = user;

  next();
}
