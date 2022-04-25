import pick from 'lodash/pick';

import { IAppContext, IQueryPayload, StatusCode } from 'common/types';
import {
  IRegisterUserPayload,
  IUser,
  ILoginPayload,
  UserType,
  NotificationType,
} from 'models/types';
import { getAuthTokens } from './auth.module';
import * as s3 from './lib/s3.module';
import { createError } from 'common/utils';

export async function login(context: IAppContext, payload: ILoginPayload, isAdminLogin?: boolean) {
  const { User } = context.conn;

  let userQuery: any;
  if (isAdminLogin) {
    userQuery = {
      _id: payload.user,
    };
  }

  let user = await User.findOne(userQuery);

  // update user logged in count
  if (!isAdminLogin) {
    user.loggedCount += 1;
    await user.save();
  }

  const publicData = User.getPublicData(user, isAdminLogin ? UserType.Admin : undefined);
  const tokens = await getAuthTokens(context, {
    id: user.id,
    type: user.type,
    email: user.email,
  });

  return {
    tokens,
    user: publicData,
  };
}

export async function registerUser(context: IAppContext, payload: IRegisterUserPayload) {
  const { User } = context.conn;

  const existingUser = await User.findOne({
    $or: [{ email: payload.email }, { username: payload.username }],
  })
    .select('_id')
    .lean();
  if (existingUser) {
    throw createError(StatusCode.BAD_REQUEST, 'User with same name and email already exists');
  }

  const user = await new User({
    ...payload,
    notifications: {
      email: {
        [NotificationType.IncomingSession]: true,
        [NotificationType.NewSession]: true,
        [NotificationType.NewMessage]: true,
      },
    },
    loggedCount: 1,
  }).save();

  return user.beautify();
}

export async function updateProfile(context: IAppContext, payload: Partial<IUser>) {
  const {
    user,
    conn: { User },
  } = context;

  // remove old avatar
  if (user.avatar && payload.avatar !== user.avatar && user.avatar.includes('eavii.com')) {
    await s3.deleteFile(user.avatar);
  }

  Object.assign(user, payload);
  await user.save();

  return User.getPublicData(user);
}

export async function getUsers(context: IAppContext, payload: IQueryPayload) {
  const {
    conn: { User },
    user,
  } = context;

  const userQuery: any = {};
  const { query = {}, pagination, sort, select } = payload;

  // just pass query for now
  Object.assign(userQuery, pick(query, ['type', 'status', '_id']));

  if (query.search) {
    try {
      const rgx = new RegExp(query.search, 'i');
      userQuery.$or = [{ username: rgx }, { email: rgx }];
    } catch (error) {
      throw createError(StatusCode.BAD_REQUEST, 'Invalid search string');
    }
  }

  const countAction = User.find(userQuery).countDocuments();
  let queryAction = User.find(userQuery);
  if (sort) {
    queryAction = queryAction.sort(sort);
  }
  if (pagination) {
    queryAction = queryAction.skip(pagination.offset * pagination.limit).limit(pagination.limit);
  }
  if (select) {
    queryAction = queryAction.select(select);
  }

  const [total, users] = await Promise.all([countAction, queryAction.lean({ virtuals: true })]);

  return {
    total,
    data: users.map((v) => User.getPublicData(v, user.type)),
  };
}
