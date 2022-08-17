import { Response, NextFunction } from 'express';
import { IRequest } from 'common/types';
import { IAuthTokenPayload } from 'models/types';
import { verifyToken } from 'modules/auth.module';

export default async function populateAuthMiddleware(req: IRequest, res: Response, next: NextFunction) {
  let accessToken = req.get('Authorization');

  if (accessToken === void 0) {
    return next();
  }

  accessToken = accessToken.split(' ').pop();

  try {
    req.auth = await verifyToken<IAuthTokenPayload>(accessToken);
  } finally {
    next();
  }
}
