import { Router } from 'express';
import formidable from 'formidable';
import fs from 'fs';
import { createController, createError, getBaseRoute } from 'common/utils';
import { IQueryPayload, IRequest, IRoute, RouterConfig, StatusCode } from 'common/types';
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
import { uploadFile } from 'modules/lib/s3.module';

export default class UserRoute implements IRoute {
  public path: string;
  public router: Router;
  public exRouter: Router;

  constructor(path: string) {
    this.path = path;
    const { router, exRouter } = getBaseRoute(RouterConfig.User);
    this.router = router;
    this.exRouter = exRouter;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      '/',
      createController(async (req: IRequest) => {
        const result = await new Promise((resolve, reject) => {
          new formidable.IncomingForm().parse(req, async (err, fields, files) => {
            if (err) {
              return reject(err);
            }

            // validate
            const cusReq = {
              body: fields,
              context: {},
            } as any;
            await new Promise(_resolve =>
              validate(userRegisterSchema)(cusReq, null, (error) =>
                error ? reject(error) : _resolve(null)
              )
            );

            if (files.idFile) {
              const uploadPath = `documents/file_${Date.now()}`;
              const buf = fs.readFileSync((files.idFile as formidable.File).filepath);
              cusReq.context.payload.idUrl = await uploadFile(
                buf,
                (files.idFile as formidable.File).mimetype,
                uploadPath,
                true
              );

              if (!cusReq.context.payload.idUrl) {
                return reject(createError(StatusCode.INTERNAL_SERVER_ERROR, 'Something went wrong'));
              }
            }

            try {
              const res = await UserModule.registerUser(req.context, cusReq.context.payload);
              resolve(res);
            } catch (error) {
              reject(error);
            }
          });
        });

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
