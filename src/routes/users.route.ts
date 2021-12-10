import { Router } from 'express';
import { createController, getBaseRoute } from 'common/utils';
import { IQueryPayload, IRequest, IRoute, RouterConfig } from 'common/types';
import validate from 'middlewares/validate.middleware';
import isAuthenticated from 'middlewares/auth.middleware';
import * as UserModule from 'modules/users.module';
import {
  getUsersSchema,
  userLoginSchema,
  userRegisterSchema,
  userUpdateSchema,
} from './validators/users.validator';
import { UserType } from 'models/types';

export default class UserRoute implements IRoute {
  public path: string;
  public router: Router;
  public exRouter: Router;

  constructor(path: string) {
    this.path = path;
    const { router, exRouter } = getBaseRoute(RouterConfig.Users);
    this.router = router;
    this.exRouter = exRouter;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      '/',
      validate(userRegisterSchema),
      createController(async (req: IRequest) => {
        const result = await UserModule.registerUser(req.context, req.context.payload);

        return result;
      })
    );

    this.router.post(
      '/login',
      validate(userLoginSchema),
      createController(async (req: IRequest) => {
        const result = await UserModule.login(req.context, req.context.payload);

        return result;
      })
    );

    this.router.get(
      '/me',
      isAuthenticated,
      createController(async (req: IRequest) => {
        const {
          conn: { User },
          user,
        } = req.context;

        return User.getPublicData(user);
      })
    );

    this.router.put(
      '/update-profile',
      validate(userUpdateSchema),
      isAuthenticated,
      createController(async (req: IRequest) => {
        const result = await UserModule.updateProfile(req.context, req.context.payload);

        return result;
      })
    );

    this.router.get(
      '/',
      validate(getUsersSchema),
      isAuthenticated,
      createController(async (req: IRequest) => {
        const {
          payload: { limit, offset, sort, ...query },
          user,
        } = req.context;
        const queryPayload: IQueryPayload = {
          query,
        };

        if (user.type === UserType.User) {
          queryPayload.query.type = UserType.Creator;
        }
        if (user.type === UserType.Creator) {
          queryPayload.query.type = UserType.User;
        }

        if (limit !== undefined && offset !== undefined) {
          queryPayload.pagination = {
            limit,
            offset,
          };
        }
        if (sort) {
          queryPayload.sort = sort;
        }

        const users = await UserModule.getUsers(req.context, queryPayload);

        return users;
      })
    );
  }
}
