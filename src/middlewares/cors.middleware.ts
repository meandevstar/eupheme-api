import { Response, NextFunction } from 'express';
import { IRequest, Environment } from 'common/types';

type WhiteListType = {
  [key: string]: string[];
};
const WHITE_LIST: WhiteListType = {
  development: ['http://localhost:3000'],
  production: [],
};

export default (req: IRequest, res: Response, next: NextFunction) => {
  const origin = req.get('origin');
  const env = process.env.NODE_ENV as Environment;

  // if (WHITE_LIST[env].indexOf(origin) !== -1) {
  res.header('Access-Control-Allow-Origin', origin);
  // }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Cache-Control', 'no-store,no-cache,must-revalidate');
  next();
};
