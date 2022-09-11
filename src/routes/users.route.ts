import { Router } from 'express';
import formidable from 'formidable';
import fs from 'fs';
import { promisify } from 'util';
import { createController, createError, formidablePromise, getBaseRoute } from 'common/utils';
import { IQueryPayload, IRequest, IRoute, RouterConfig, StatusCode } from 'common/types';
import validate from 'middlewares/validate.middleware';
import isAuthenticated from 'middlewares/auth.middleware';
import * as UserModule from 'modules/users.module';
import {
  flirtRequestSchema,
  getUsersSchema,
  userLoginSchema,
  userProfileSchema,
  userRegisterSchema,
  userUpdateSchema,
} from './validators/users.validator';
import { UserType } from 'models/types';
import { uploadFile, createSignedUrl } from 'modules/lib/s3.module';
import { result } from 'lodash';
import { getOrCreateRoomSchema } from './validators/chats.validator';

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
      createController(async (req: IRequest, res: any) => {
        const { fields, files } = await formidablePromise(req);
        // validate
        const cusReq = {
          body: fields,
          context: {},
        } as any;
        await promisify(validate(userRegisterSchema))(cusReq, res);

        if (cusReq.context.payload.type === UserType.Creator) {
          if (files.idFile) {
            const uploadPath = `documents/file_${Date.now()}`;
            const buf = fs.readFileSync((files.idFile as formidable.File).filepath);
            cusReq.context.payload.idUrl = await uploadFile(
              buf,
              (files.idFile as formidable.File).mimetype,
              uploadPath,
              false
            );

            if (!cusReq.context.payload.idUrl) {
              throw createError(
                StatusCode.INTERNAL_SERVER_ERROR,
                'Something went wrong, please try again later'
              );
            }
          } else {
            throw createError(StatusCode.BAD_REQUEST, 'ID File is required');
          }
        } else if (files.idFile) {
          throw createError(StatusCode.BAD_REQUEST, 'ID file is not valid payload');
        }

        const result = await UserModule.registerUser(req.context, cusReq.context.payload);

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
        // User.getPublicData(user, isAdminLogin ? UserType.Admin : undefined);
        return User.getProfileData(user);
      })
    );

    this.router.get(
      '/profile/:id',
      validate(userProfileSchema),
      isAuthenticated,
      createController(async (req: IRequest) => {
        const { user } = req.context;
        const result = await UserModule.getUserPublicProfile(req.context, req.context.payload);
        return result;
      })
    );

    // this.router.get(
    //   '/profile',
    //   isAuthenticated,
    //   createController(async (req: IRequest) => {
    //     const {
    //       conn: { User },
    //       user,
    //     } = req.context;

    //     return User.getPublicData(user);
    //   })
    // );

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
    this.router.post(
      '/sendflirtRequest',
      validate(flirtRequestSchema),
      isAuthenticated,
      createController(async (req: IRequest, res: any) => {
        const result = await UserModule.sendFlirtRequest(req.context, req.context.payload);

        return result;
      })
    );
    this.router.get(
      '/getflirtRequestList',
      isAuthenticated,
      createController(async (req: IRequest, res: any) => {
        const result = await UserModule.getFlirtsList(req.context, req.context.payload);
        return result;
      })
    );
    this.router.get(
      '/profileStats',
      isAuthenticated,
      createController(async (req: IRequest, res: any) => {
        const result = await UserModule.getFlirtsListCount(req.context, req.context.payload);
        return result;
      })
    );

    this.router.post(
      '/uploadMedia',
      createController(async (req: IRequest, res: any) => {
        const { fields, files } = await formidablePromise(req);
        const { userId, mediaType, isStory } = fields;
        // const buf = fs.readFileSync((files.idFile as formidable.File).filepath);
        // console.log('filr itself', files);
        const fileName = (files.file as formidable.File).originalFilename;
        if (files.file) {
          console.log('gilr', files.file);
          const uploadPath = `images/${userId}/${fileName}`;
          const buf = fs.readFileSync((files.file as formidable.File).filepath);
          await uploadFile(buf, (files.file as formidable.File).mimetype, uploadPath, true);
          const url = createSignedUrl(uploadPath, true);
          const result = await UserModule.updateUsersMediaUrl(req.context, {
            userId,
            mediaType: mediaType === 'image' ? 'image' : 'video',
            url,
            fileName,
            isStory,
          });
          if (!result) {
            throw createError(
              StatusCode.INTERNAL_SERVER_ERROR,
              'Something went wrong, please try again later'
            );
          } else {
            return result;
          }
        } else {
          throw createError(StatusCode.BAD_REQUEST, 'File is required');
        }
      })
    );
  }
}
