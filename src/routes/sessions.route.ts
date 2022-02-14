import { Router } from 'express';
import { createController, getBaseRoute } from 'common/utils';
import { IRequest, IRoute, RouterConfig } from 'common/types';
import validate from 'middlewares/validate.middleware';
import isAuthenticated from 'middlewares/auth.middleware';
import * as SessionsModule from 'modules/sessions.module';
import {
  createSessionSchema,
  getSessionsSchema,
  updateSessionSchema,
} from './validators/sessions.validator';
import { paginationSchema } from './validators/global.validator';

export default class SessionRoute implements IRoute {
  public path: string;
  public router: Router;
  public exRouter: Router;

  constructor(path: string) {
    this.path = path;
    const { router, exRouter } = getBaseRoute(RouterConfig.Session);
    this.router = router;
    this.exRouter = exRouter;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      '/',
      isAuthenticated,
      validate(createSessionSchema),
      createController(async (req: IRequest) => {
        const result = await SessionsModule.createSession(req.context, req.body);
        return result;
      })
    );

    this.router.get(
      '/',
      isAuthenticated,
      validate(getSessionsSchema),
      createController(async (req: IRequest) => {
        const {
          payload: { startTime, endTime, target, limit, offset },
          user: sessionUser,
        } = req.context;
        const { total, data } = await SessionsModule.getSessions(req.context, {
          query: {
            startTime,
            endTime,
            target,
          },
          pagination: {
            limit,
            offset,
          },
          populate: [
            {
              path: 'user provider',
              select: 'firstName lastName skills avatar rating email',
            },
          ],
        });

        return {
          total,
          data,
        };
      })
    );

    this.router.get(
      '/upcoming',
      isAuthenticated,
      validate(paginationSchema),
      createController(async (req: IRequest) => {
        const { limit, offset, sort } = req.context.payload;
        const result = await SessionsModule.getUpcomingSessions(req.context, {
          pagination: {
            limit,
            offset,
          },
          sort,
        });
        return result;
      })
    );

    this.router.put(
      '/:id',
      validate(updateSessionSchema),
      isAuthenticated,
      createController(async (req: IRequest) => {
        const result = await SessionsModule.updateSession(
          req.context,
          req.params.id,
          req.context.payload
        );
        return result;
      })
    );

    this.router.delete(
      '/:id',
      isAuthenticated,
      createController(async (req: IRequest) => {
        const result = await SessionsModule.cancelSession(req.context, req.params.id);
        return result;
      })
    );

    this.router.get(
      '/:id/token',
      isAuthenticated,
      createController(async (req: IRequest) => {
        const result = await SessionsModule.getSessionToken(req.context, req.params.id);
        return result;
      })
    );

    this.router.post(
      '/:id/call',
      isAuthenticated,
      createController(async (req: IRequest) => {
        const result = await SessionsModule.startCall(req.context, req.params.id);
        return result;
      })
    );
  }
}