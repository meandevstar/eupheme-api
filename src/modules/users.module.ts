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
  IMedia,
  IMediaType,
  ISpecialRequest,
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

export async function sendSpecialRequest(context: IAppContext, payload: Partial<ISpecialRequest>) {
  const {
    user,
    conn: { User, SpecialRequest },
  } = context;
  console.log('Yes I am here', payload);
  const senderid = user.id;
  const userId = payload.userId;
  const specialMessage = payload.specialMessage;
  // SpecialRequest
  try {
    const SR = await new SpecialRequest({ senderid, userId, specialMessage }).save();
    return SR;
  } catch (error) {
    throw createError(StatusCode.BAD_REQUEST, error.message);
  }

  // let specialRequest =
  // Object.assign(user, payload);
  // await user.save();

  // return { senderId: senderId, message: message, userID: userId };
  // return payload;
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
  const { User, Media } = context.conn;

  console.log('working with', 'userId', userId.id);
  try {
    let userInfo = await User.find({ _id: userId.id });
    if (userInfo) {
      let userPublicStory: any = await Media.find({
        creator: mongoose.Types.ObjectId(userId.id),
        private: false,
      });
      let userPrivateImages: any = await Media.find({
        creator: mongoose.Types.ObjectId(userId.id),
        private: true,
        type: IMediaType.Image,
      });
      let userPrivateVideos: any = await Media.find({
        creator: mongoose.Types.ObjectId(userId.id),
        private: false,
        type: IMediaType.Video,
      });

      // console.log(userInfo);
      if (userInfo.length === 0) {
        throw createError(StatusCode.FORBIDDEN, 'profile not found');
      } else {
        // if (userInfo[0].type === UserType.User) {
        //   throw createError(StatusCode.NOT_FOUND, 'Profile does not exist');
        // } else {
        const [userDetail, stories, privateImages, privateVideos] = await Promise.all([
          User.getPublicData(userInfo[0], userInfo[0].type),
          userPublicStory.map((story: any) => {
            return { url: story.file };
          }),
          userPrivateImages.map((image: any) => {
            //TODO:handle private images
            const newStr = image.file.replace('/private/', '/');
            const newStr1 = newStr.replace('file', 'thb_file');
            return { thumbnail: newStr1, blurred: image.blurred };
            // return image
          }),
          userPrivateVideos.map((video: any) => {
            return { thumbnail: video.file, blurred: video.blurred };
            // return video;
          }),
        ]);
        // const userDetail ={userInfo.name, userInfo.}
        return { userDetail, stories, privateImages, privateVideos };
        // }
      }
    }
  } catch (error) {
    throw createError(StatusCode.BAD_REQUEST, error.message);
  }
}
export async function sendFlirtRequest(context: IAppContext, payload: any) {
  const {
    conn: { Flirt, User },
    user,
  } = context;
  try {
    // console.log('payload saved', flirt);
    let userInfo = await User.findById(payload.toId);
    console.log('user info: ', userInfo?.name);
    // return;
    if (!userInfo) {
      throw createError(StatusCode.FORBIDDEN, 'profile not found');
    } else {
      // console.log('this is flirt request end point', payload);
      if (userInfo.type === UserType.Creator && user.type === UserType.Creator) {
        throw createError(StatusCode.NOT_ACCEPTABLE, 'you can not send flirt request');
      } else if (userInfo.type === UserType.User && user.type === UserType.User) {
        throw createError(StatusCode.NOT_ACCEPTABLE, 'you can not send flirt request');
      } else {
        const flirt = await new Flirt({
          toid: payload.toId,
          fromId: user._id,
        }).save();
        return flirt;
      }
    }
  } catch (error) {
    throw createError(StatusCode.BAD_REQUEST, error.message);
  }
}
export async function getFlirtsListCount(context: IAppContext, payload: any) {
  const {
    conn: { Flirt },
    user,
  } = context;
  try {
    const countFlirts = await Flirt.count({ toid: user._id });
    return { flirts: countFlirts };
  } catch (error) {
    throw createError(StatusCode.BAD_REQUEST, error.message);
  }
}
export async function getFlirtsList(context: IAppContext, payload: any) {
  const {
    conn: { Flirt },
    user,
  } = context;
  // console.log('this is flirt request end point');
  try {
    const flirt = await Flirt.aggregate([
      { $match: { toid: mongoose.Types.ObjectId(user.id) } },
      // { "$unwind": "$projects" },
      {
        $lookup: {
          from: 'users',
          localField: 'fromId',
          foreignField: '_id',
          as: 'fromUser',
        },
      },
      { $unwind: '$fromUser' },
      {
        $project: {
          userName: '$fromUser.name',
          useridUrl: '$fromUser.idUrl',
          flirtback: 1,
          userId: '$fromUser._id',
        },
      },
    ]);
    // { $match: { _id: mongoose.Types.ObjectId(userId.id) } }
    console.log('payload saved', flirt);
    // let userInfo = User.find({ _id: userId.id });
    // console.log('user info: ', userInfo);
    // if (!userInfo) {
    //   throw createError(StatusCode.FORBIDDEN, 'profile not found');
    // } else {
    return flirt;
    // }
  } catch (error) {
    throw createError(StatusCode.BAD_REQUEST, error.message);
  }
}

export async function updateUsersMediaUrl(context: IAppContext, payload: UpdatedMediaUrlPayload) {
  const {
    user,
    conn: { Media, User },
  } = context;
  const { userId, mediaType, url, fileName, isStory } = payload;
  try {
    const mediaPayload: IMedia = {
      name: fileName,
      description: 'Media Upload',
      creator: mongoose.Types.ObjectId(userId),
      private: isStory,
      file: url,
    };
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
    console.log('this is error', error);
    throw createError(StatusCode.BAD_REQUEST, 'Something Went Wrong');
  }
}
