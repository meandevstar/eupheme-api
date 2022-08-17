import { NextFunction } from 'express';
import { IRequest } from 'common/types';

export default function unless(paths: string | string[], middleware?: Function) {
  if (paths instanceof Array === false) {
    paths = [paths as string];
  }

  return (req: IRequest, res: Response, next: NextFunction) => {
    for (const path of paths) {
      if (req.path.startsWith(path)) {
        return next();
      }
    }

    if (middleware) {
      return middleware(req, res, next);
    }
  };
}
