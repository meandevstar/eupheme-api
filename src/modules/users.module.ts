import pick from 'lodash/pick';
var mongoose = require('mongoose');

import { IAppContext, IQueryPayload, StatusCode } from 'common/types';
import {
  IRegisterUserPayload,
  IUser,
  ILoginPayload,
  UserType,
  NotificationType,
  UpdatedMediaUrlPayload,
  IMedia
} from 'models/types';
import { getAuthTokens } from './auth.module';
import * as s3 from './lib/s3.module';
import { createError, verifyPassword } from 'common/utils';
import userSchema from 'models/schemas/user.schema';

export async function login(context: IAppContext, payload: ILoginPayload, isAdminLogin?: boolean) {
  const { User } = context.conn;
  console.log('USER', payload);
  let userQuery: any;
  if (isAdminLogin) {
    userQuery = {
      _id: payload.user,
    };
  } else {
    userQuery = {
      email: payload.email,
    };
  }
  try {
    let user = await User.findOne(userQuery);
    if (!user) throw createError(StatusCode.BAD_REQUEST, 'user does not exist');

    console.log('isAdminLogin ? ', isAdminLogin);
    console.log('USER via query', user);
    if (!verifyPassword(payload.password, user.password)) {
      throw createError(StatusCode.BAD_REQUEST, 'password is incorrect');
    }
    if (!isAdminLogin) {
      // update user logged in count
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
  } catch (error) {
    // console.log("ERROR", error.message)
    throw createError(StatusCode.BAD_REQUEST, error.message);
  }
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

  if (query.pronoun) {
    let pronouns: string[];
    if (typeof query.pronoun === 'string') {
      pronouns = [query.pronoun];
    } else {
      pronouns = query.pronoun;
    }
    userQuery.pronoun = {
      $in: pronouns,
    };
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

export async function getUserPublicProfile(context: IAppContext, userId: any) {
  const { User } = context.conn;
  console.log('working with', 'userId', userId.id);
  try {
    //let userInfo = User.find({ _id: userId.id });
    let  userInfo=await User.aggregate([
      { $match : { _id :mongoose.Types.ObjectId(userId.id) } },

      { 
        $lookup:{
            from:"medias" ,
            let:{privateImageId:"$privateImagesThumbnails"},
            pipeline:[
              {
                $match:{creator:"$$privateImageId"}
              },
              {
                $project:{
                  file:1
                }
              },
            ],

            as:"privateImagesThumnailsss"
        }
       }
    
    ])
 
    if (!userInfo) {
      throw createError(StatusCode.FORBIDDEN, 'profile not found');
    } else {
      return userInfo;
     }
  } catch (error) {
    throw createError(StatusCode.BAD_REQUEST, error.message);
  }
}
export async function sendFlirtRequest(context: IAppContext, userId: any) {
  const {
    conn: { User },
    user,
  } = context;
  console.log('this is flirt request end point');
  try {
    // let userInfo = User.find({ _id: userId.id });
    // if (!userInfo) {
    //   throw createError(StatusCode.FORBIDDEN, 'profile not found');
    // } else {
    //   return userInfo;
    // }
  } catch (error) {
    // throw createError(StatusCode.BAD_REQUEST, error.message);
  }
}
 
export async function updateUsersMediaUrl(context: IAppContext, payload: UpdatedMediaUrlPayload) {
  const {
    user,
    conn: { Media,User },
  } = context;  
  const { userId, mediaType, url,fileName,isStory } = payload;
  try {
    const mediaPayload: IMedia = {
      name:fileName,
      description:"Media Upload",
      creator: mongoose.Types.ObjectId(userId),
      private:isStory ,
      file:url
    }
    const media = await new Media(mediaPayload).save();
    const updatedUser = await User.findOneAndUpdate(
             { _id: userId },
             ...(mediaType === 'image'
               ? [
                   {
                     $push: { privateImagesThumbnails: media?._id },
                   },
                 ]
               : [
                   {
                     $push: { privateVideosThumbnails: media?._id },
                  },
                ])
          );
           return updatedUser;
   
  } catch (error) {
    console.log("this is error",error);
    throw createError(StatusCode.BAD_REQUEST, 'Something Went Wrong');
  }
}