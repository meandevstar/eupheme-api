import http from 'http';
import express from 'express';
import Mongoose from 'mongoose';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Emitter } from '@socket.io/redis-emitter';
import omit from 'lodash/omit';
import { pubClient, subClient } from './redis.module';
import config from 'common/config';
import { createError } from 'common/utils';
import { IAppContext, RedisKey, StatusCode } from 'common/types';
import { IAuthTokenPayload, SessionStatus, UserType } from 'models/types';
import { verifyToken } from 'modules/auth.module';
import * as redis from './redis.module';
import logger from './logger.module';
import { updateSession } from 'modules/sessions.module';

let server: http.Server;
let io: Server;
let redisEmitter: Emitter;
let context: IAppContext;
const sockets: Socket[] = [];

export function initialize(ctx: IAppContext) {
  context = ctx;

  server = http.createServer(express());
  server.listen(config.socketPort, () => {
    console.log(`Socket server is listening on the port ${config.socketPort}`);
  });

  io = new Server(server, {
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
    cors: {
      origin: '*',
    },
  });
  io.adapter(createAdapter(pubClient, subClient));

  redisEmitter = new Emitter(pubClient);

  io.engine.on('connection_error', (err: any) => {
    console.log(err.code, err.message);
  });
  io.use(async (socket, next) => {
    const { token } = socket.handshake.auth;
    if (!token) {
      return next(createError(StatusCode.UNAUTHORIZED, 'Authorization is required'));
    }

    let tokenParsed: IAuthTokenPayload;
    try {
      tokenParsed = await verifyToken<IAuthTokenPayload>(token);
    } catch (error) {
      return next(createError(StatusCode.UNAUTHORIZED, 'Session expired'));
    }
    // create new session
    socket.data = tokenParsed;
    next();
  });

  io.on('connection', async (socket) => {
    // store in cache
    sockets.push(socket);

    registerGlobalEvents();
    registerUserEvents(socket);
    registerSocketEvents(socket);
  });
}

async function registerUserEvents(socket: Socket) {
  // update online users list and notify
  redis.sadd(RedisKey.OnlineUsers, socket.data.id);
  const onlineUserIds = await redis.smembers(RedisKey.OnlineUsers);
  const onlineUsers = await context.conn.User.find({
    _id: {
      $in: onlineUserIds,
    },
  })
    .select('firstName lastName email type avatar')
    .lean({ virtuals: true });

  // Only dispatch user => creator and creator => user relation (except admin)
  const onlineUsersPayload = onlineUsers.map((v) => omit(v, ['_id']));
  Object.values(UserType)
    .filter((type) => type !== socket.data.id || type === UserType.Admin)
    .map((type) => {
      io.of('/').to(getUserTypeRoomName(type)).emit('online_users', onlineUsersPayload);
    });

  // join account room
  socket.join(getAccountRoomName(socket.data.id));
  // join to default global room specific per user type
  socket.join(getUserTypeRoomName(socket.data.type));
}

function registerGlobalEvents() {
  // global pubsub handler
  redis.subscribe('gn', ({ type, data }: { type: string; data: any }) => {
    if (type === 'room') {
      roomHandler(data.action, data.room, data.users, true);
    }
  });
}

function registerSocketEvents(socket: Socket) {
  // chat typing event
  socket.on('chat_typing', ({ room, typing }: { room: string; typing: boolean }) => {
    if (!room) {
      return;
    }

    io.of('/').in(getChatRoomName(room)).emit('chat_typing', {
      user: socket.data.id,
      typing,
    });
  });

  // user leave chat room event
  socket.on('leave_room', ({ rooms }: { rooms: string[] }) => {
    if (!rooms || !rooms.length) {
      return;
    }

    rooms.forEach((room) => {
      if (!room) {
        return;
      }

      const roomName = getChatRoomName(room);
      
      if (socket.rooms.has(roomName)) {
        socket.leave(getChatRoomName(room));
      }
    });
  });

  // user call status notification
  socket.on(
    'call_status',
    async (payload: { session: string; user: string; status: 'accepted' | 'rejected' }) => {
      if (!payload.session || !payload.user || !payload.status) {
        return;
      }

      if (payload.status === 'accepted') {
        // update session call time
        const newContext = {
          user: socket.data,
          ...context
        } as unknown as IAppContext;
        updateSession(newContext, payload.session, { status: SessionStatus.InProgress });
      }

      // send event
      io.of('/').in(getAccountRoomName(payload.user)).emit('call_status', payload);
    }
  );

  // disconnect handler
  socket.on('disconnect', async () => {
    const matchingSockets = await io.in(getAccountRoomName(socket.data.id)).allSockets();
    const isDisconnected = matchingSockets.size === 0;
    if (isDisconnected) {
      // notify other users
      socket.broadcast.emit('user_status', {
        id: socket.data.id,
        connected: false,
      });

      // update online users
      redis.srem(RedisKey.OnlineUsers, socket.data.id);
    }
  });
}

export function roomHandler(
  action: 'join' | 'leave',
  room: string,
  users: string[],
  published?: boolean
) {
  if (!published) {
    redis.publish('gn', {
      type: 'room',
      data: {
        action,
        room,
        users,
      },
    });
    return;
  }

  sockets.forEach((socket) => {
    if (users.includes(socket.data.id)) {
      socket[action](room);
    }
  });
}

export function getAccountRoomName(userId: string | Mongoose.Types.ObjectId) {
  return `u_${userId.toString()}`;
}

export function getChatRoomName(roomId: string | Mongoose.Types.ObjectId) {
  return `room_${roomId.toString()}`;
}

export function getUserTypeRoomName(type: UserType) {
  return `user_type_${type}`;
}

export async function isUserOnline(userId: string | Mongoose.Types.ObjectId) {
  const isOnline = await redis.sismember(RedisKey.OnlineUsers, userId.toString());
  return Boolean(isOnline);
}

export async function isUserInRoom(userId: string | Mongoose.Types.ObjectId, roomName: string) {
  const sockets = await io.of('/').in(roomName).fetchSockets();
  const isInRoom = sockets.some((socket) => socket.data.id === userId.toString());

  return isInRoom;
}

export function getSocket() {
  return io;
}

export function getEmitter() {
  return redisEmitter;
}

export function closeSocketServer() {
  server.close(() => logger.info('Socket server closed'));
}
