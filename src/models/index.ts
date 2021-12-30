import Mongoose from 'mongoose';
import config from 'common/config';
import logger from 'modules/lib/logger.module';
import userSchema from './schemas/user.schema';
import { ConnType, IConnection, IDBConnectionMap } from 'common/types';
import {
  IUserDocument,
  ISessionDocument,
} from 'models/types';
import sessionSchema from './schemas/session.schema';

const connections: IDBConnectionMap = {};

function registerModels(conn: IConnection) {
  conn.User = conn.model<IUserDocument>('User', userSchema, 'users');
  conn.Session = conn.model<ISessionDocument>('Session', sessionSchema, 'sessions');

  // create collections if does not exists, to support multi-transaction
  conn.User.createCollection();
  conn.Session.createCollection();

  // ensure indexes
  conn.User.ensureIndexes();
  conn.Session.ensureIndexes();
}

export async function connect(singleConnMode?: boolean, uri?: string) {
  try {
    // opening multi connections
    const connectActions = [];
    const connectionKeys = !singleConnMode ? Object.values(ConnType) : [ConnType.Background];
    for (const key of connectionKeys) {
      connectActions.push(
        (async () => {
          const conn = await Mongoose.createConnection(uri || config.dbUrl, {
            maxPoolSize: 10,
            minPoolSize: 5,
          }).asPromise();
          connections[ConnType[key]] = conn;

          conn.set('debug', process.env.DEBUG === '1');

          if (config.testMode !== '1') {
            console.log(`✅️ ${ConnType[key]} Connection established`);
          }

          registerModels(connections[ConnType[key]]);
        })()
      );
    }
    await Promise.all(connectActions);

    if (config.testMode !== '1') {
      console.info('🔥 DB successfully connected!');
    }
  } catch (error) {
    logger.error('Mongodb connection error', { error });
  }
}

export async function disconnect(singleConnMode?: boolean) {
  try {
    // closing all connections
    const connectionKeys = !singleConnMode ? Object.values(ConnType) : [ConnType.Background];

    for (const key of connectionKeys) {
      connections[ConnType[key]].close();

      if (config.testMode !== '1') {
        console.log(`${ConnType[key]} Connection closed`);
      }
    }
  } catch (error) {
    logger.error('Mongodb connection close error', { error });
  }
}

/**
 * Get models by connection type
 */
export function getConnection(connKey = ConnType.Default): IConnection {
  return connections[connKey];
}
