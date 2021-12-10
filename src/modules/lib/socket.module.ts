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
import { IAuthTokenPayload, UserType } from 'models/types';
import { verifyToken } from 'modules/auth.module';
import * as redis from './redis.module';
import logger from './logger.module';

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

    registerUserEvents(socket);
    registerGlobalEvents(socket);
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

  // this is only used in admin/doctor panel
  if (socket.data.type !== UserType.User) {
    socket.emit(
      'online_users',
      onlineUsers.map((v) => omit(v, ['_id']))
    );
  }

  // notify online status
  socket.broadcast.emit('user_status', {
    id: socket.data.id,
    connected: true,
  });

  // join account room
  socket.join(getAccountRoomName(socket.data.id));
}

function registerGlobalEvents(socket: Socket) {
  // global pubsub handler
  redis.subscribe('gn', ({ type, data }: { type: string; data: any }) => {});
}

function registerSocketEvents(socket: Socket) {
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

export function getAccountRoomName(userId: string | Mongoose.Types.ObjectId) {
  return `u_${userId.toString()}`;
}

export function getChatRoomName(roomId: string | Mongoose.Types.ObjectId) {
  return `room_${roomId.toString()}`;
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
