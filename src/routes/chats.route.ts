import { Router } from 'express';
import { createController, createError, getBaseRoute } from 'common/utils';
import { IRequest, IRoute, RouterConfig, StatusCode } from 'common/types';
import isAuthenticated from 'middlewares/auth.middleware';
import validate from 'middlewares/validate.middleware';
import { UserType } from 'models/types';
import * as ChatModule from 'modules/chats.module';
import {
  getMessageSchema,
  getOrCreateRoomSchema,
  markAsReadSchema,
  sendMessageSchema,
} from './validators/chats.validator';
import { paginationSchema } from './validators/global.validator';

export default class ChatRoute implements IRoute {
  public path: string;
  public router: Router;
  public exRouter: Router;

  constructor(path: string) {
    this.path = path;
    const { router, exRouter } = getBaseRoute(RouterConfig.Chats);
    this.router = router;
    this.exRouter = exRouter;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(
      '/rooms',
      validate(paginationSchema),
      isAuthenticated,
      createController(async (req: IRequest) => {
        const { limit, offset, sort } = req.context.payload;
        const result = await ChatModule.getRooms(req.context, {
          pagination: {
            limit,
            offset,
          },
          sort,
        });

        return result;
      })
    );

    this.router.post(
      '/rooms',
      validate(getOrCreateRoomSchema),
      isAuthenticated,
      createController(async (req: IRequest) => {
        const { user, payload } = req.context;
        if (user.type === UserType.User && payload.participants) {
          throw createError(StatusCode.BAD_REQUEST, 'participants array is not allowed');
        }
        const result = await ChatModule.getOrCreateRoom(req.context, payload);

        return result;
      })
    );

    this.router.get(
      '/unread-count',
      isAuthenticated,
      createController(async (req: IRequest) => {
        const result = await ChatModule.getUnreadMessageCount(req.context);

        return result;
      })
    );

    this.router.post(
      '/mark-as-read',
      validate(markAsReadSchema),
      isAuthenticated,
      createController(async (req: IRequest) => {
        const { rooms } = req.context.payload;
        const result = await ChatModule.markAsRead(req.context, rooms);

        return result;
      })
    );

    this.router.get(
      '/rooms/:id/messages',
      validate(getMessageSchema),
      isAuthenticated,
      createController(async (req: IRequest) => {
        const { id, limit, offset, sort } = req.context.payload;
        const result = await ChatModule.getMessages(req.context, {
          query: {
            room: id,
          },
          pagination: {
            limit,
            offset,
          },
          sort,
        });

        return result;
      })
    );

    this.router.post(
      '/rooms/:id/messages',
      validate(sendMessageSchema),
      isAuthenticated,
      createController(async (req: IRequest) => {
        const payload = {
          room: req.params.id,
          ...req.context.payload,
        };
        const result = await ChatModule.sendMessage(req.context, payload);

        return result;
      })
    );
  }
}