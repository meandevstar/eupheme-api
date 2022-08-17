import Mongoose, { Types, LeanDocument } from 'mongoose';
import pick from 'lodash/pick';
import omit from 'lodash/omit';
import isEmpty from 'lodash/isEmpty';
import { IAppContext, IQueryPayload, ISelectPayload, RedisKey, StatusCode } from 'common/types';
import { createError } from 'common/utils';
import {
  IMessage,
  IRoom,
  ISendNotificationPayload,
  IUserDocument,
  NotificationStatus,
  NotificationType,
  UserStatus,
} from 'models/types';
import {
  getChatRoomName,
  getEmitter,
  isUserOnline,
  isUserInRoom,
  roomHandler,
} from './lib/socket.module';
import * as redis from './lib/redis.module';
import { sendNotification } from './notifications.module';
import { getUsers } from './users.module';

export async function getOrCreateRoom(
  context: IAppContext,
  payload: Partial<IRoom> & { id?: string }
) {
  const {
    conn: { User, Room },
    user,
  } = context;

  let chatRoom;
  if (payload.id) {
    chatRoom = await Room.findById(payload.id).select('participants');

    if (!chatRoom) {
      throw createError(StatusCode.BAD_REQUEST, 'Chat room does not exists');
    }

    payload.participants = chatRoom.participants as Mongoose.Types.ObjectId[];
  } else if (payload.participants) {
    const isSelfIncluded = payload.participants.includes(user.id);

    if (isSelfIncluded) {
      throw createError(StatusCode.BAD_REQUEST, 'Do not include yourself in participants array');
    }
  }

  const participants = await User.find({
    _id: { $in: payload.participants as Mongoose.Types.ObjectId[] },
    status: {
      $ne: UserStatus.Disabled,
    },
  })
    .select('firstName lastName avatar type rating')
    .lean({
      virtuals: true,
    });

  if (participants.length !== payload.participants.length) {
    throw createError(StatusCode.FORBIDDEN, 'Participant does not exists');
  }

  // check existing rooms
  const newParticipants = payload.participants.concat(user.id);
  if (!chatRoom) {
    chatRoom = await Room.findOne({
      $and: [
        { participants: { $all: newParticipants } },
        { participants: { $size: newParticipants.length } },
      ],
    });
  }
  if (!chatRoom) {
    chatRoom = await new Room({
      creator: user.id,
      participants: newParticipants,
      description: `${participants.map((v) => v.username).join(', ')} and ${user.username}`,
    }).save();
  }

  const result = chatRoom.beautify();
  result.participants = participants.concat(
    pick(user.beautify(), ['id', 'type', 'firstName', 'lastName', 'avatar']) as any
  );

  // join all sockets of participants
  roomHandler(
    'join',
    getChatRoomName(chatRoom.id),
    chatRoom.participants.map((v) => v.toString())
  );

  return result;
}

export async function sendMessage(context: IAppContext, payload: Partial<IMessage>) {
  const {
    conn: { Room, Message },
    user,
  } = context;

  if (!payload.room) {
    throw createError(StatusCode.BAD_REQUEST, 'Room is required');
  }

  // TODO: use redis to fetch room info
  const room = await Room.findOne({
    _id: payload.room as unknown as string,
    participants: user.id,
  })
    .populate({
      path: 'participants',
      select: 'username notifications',
    })
    .select('participants')
    .lean({ virtuals: true });
  if (!room) {
    throw createError(StatusCode.FORBIDDEN, 'Room does not exists');
  }

  const message = await new Message({
    user: user.id,
    type: payload.type,
    room: payload.room,
    content: payload.content,
  }).save();

  // send message to channel
  const emitter = getEmitter();
  const content = {
    ...message.toObject({ virtuals: true }),
    user: pick(user, ['id', 'avatar', 'username']),
  };

  const roomName = getChatRoomName(payload.room.toString());
  emitter.of('/').to(roomName).emit('message', content);

  // check if user is in room
  room.participants.forEach(async (participant: Mongoose.PopulatedDoc<IUserDocument>) => {
    // skip notification for actor
    if (participant.id === user.id) {
      return;
    }
    const [isOnline, isInRoom] = await Promise.all([
      isUserOnline(participant.id),
      isUserInRoom(participant.id, roomName),
    ]);

    // TODO: add redis to include sender name
    const notificationPayload: ISendNotificationPayload = {
      user: participant.id,
      notifications: (participant as any).notifications,
      type: NotificationType.NewMessage,
      meta: {
        room: payload.room,
      },
    };

    sendNotification(context, notificationPayload, {
      inApp: !isInRoom,
      email: !isOnline && (participant as any).notifications.email[NotificationType.NewMessage],
      // sms: !isOnline && (participant as any).notifications.sms[NotificationType.NewMessage],
      createEntity: !isInRoom,
    });
  });

  return content;
}

export async function getRooms(context: IAppContext, payload: IQueryPayload) {
  const {
    conn: { Room, Notification },
    user,
  } = context;

  const unreadMessageInfo = await Notification.aggregate([
    {
      $match: {
        user: user._id,
        status: NotificationStatus.Unread,
        type: NotificationType.NewMessage,
      },
    },
    {
      $group: {
        _id: '$meta.room' as any,
        count: {
          $sum: 1,
        },
        lastMessageAt: { $last: '$createdAt' },
      },
    },
  ]);
  const newMessageRoomIds = unreadMessageInfo.map((v) => v._id);

  const { query = {}, pagination } = payload;
  const queryStages = [
    {
      $match: {
        ...query,
        participants: user._id,
      },
    },
  ];

  const paginationStages = [];
  if (pagination?.limit !== undefined && pagination?.offset !== undefined) {
    paginationStages.push(
      {
        $addFields: {
          hasNewMessage: {
            $in: ['$_id', newMessageRoomIds],
          },
        },
      },
      {
        $sort: {
          hasNewMessage: -1 as any,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'participants',
        },
      },
      { $skip: pagination.limit * pagination.offset },
      { $limit: pagination.limit },
      {
        $project: {
          hasNewMessage: 1,
          description: 1,
          createdAt: 1,
          'participants._id': 1,
          'participants.firstName': 1,
          'participants.lastName': 1,
          'participants.type': 1,
          'participants.avatar': 1,
        },
      }
    );
  }

  const [[totalInfo], rooms] = await Promise.all([
    Room.aggregate([...queryStages, { $count: 'total' }]),
    Room.aggregate([...queryStages, ...paginationStages]),
  ]);

  const data = rooms
    .map((room) => {
      const newMessageRoom = unreadMessageInfo.find((v) => room._id.equals(v._id)) || {};
      return omit(
        {
          ...room,
          ...newMessageRoom,
        },
        ['hasNewMessage']
      );
    })
    .sort((b, a) => {
      if (!a.lastMessageAt || !b.lastMessageAt) {
        return 0;
      }

      return a.lastMessageAt.getTime() - b.lastMessageAt.getTime();
    });

  return {
    total: totalInfo?.total,
    data,
  };
}

export async function getMessages(context: IAppContext, payload: IQueryPayload) {
  const {
    conn: { Room, Message },
    user,
  } = context;

  const { query, pagination, sort } = payload;

  const room = await Room.findOne({
    _id: query.room,
    participants: user.id,
  })
    .select('participants')
    .lean({ virtuals: true });
  if (!room) {
    throw createError(StatusCode.BAD_REQUEST, 'Room does not exists');
  }

  const total = await Message.find(query).countDocuments();
  let queryAction = Message.find(query).populate({
    path: 'user',
    select: 'firstName lastName type avatar',
  });
  if (sort) {
    queryAction = queryAction.sort(sort);
  }
  if (pagination?.limit !== undefined && pagination?.offset !== undefined) {
    queryAction = queryAction.skip(pagination.offset * pagination.limit).limit(pagination.limit);
  }

  const messages = await queryAction.lean({ virtuals: true });
  return {
    total,
    data: messages.map((v) => omit(v, ['_id'])),
  };
}

export async function getUnreadMessageCount(context: IAppContext) {
  const {
    conn: { Notification },
    user,
  } = context;

  const result = await Notification.aggregate([
    {
      $match: {
        user: user._id,
        status: NotificationStatus.Unread,
        type: NotificationType.NewMessage,
      },
    },
    { $count: 'total' },
  ]);

  return result?.[0].total ?? 0;
}

export async function markAsRead(context: IAppContext, roomIds: string[]) {
  const {
    conn: { Notification },
    user,
  } = context;

  if (!roomIds.length) {
    throw createError(StatusCode.BAD_REQUEST, 'Room ids are empty');
  }

  await Notification.updateMany(
    {
      user: user.id,
      'meta.room': { $in: roomIds.map((v) => new Types.ObjectId(v)) },
    },
    { $set: { status: NotificationStatus.Read } }
  );
}