import { Router } from 'express';
import { promisify } from 'util';
import formidable from 'formidable';
import { createController, createError, formidablePromise, getBaseRoute } from 'common/utils';
import { IQueryPayload, IRequest, IRoute, RouterConfig, StatusCode } from 'common/types';
import isAuthenticated from 'middlewares/auth.middleware';
import validate from 'middlewares/validate.middleware';
import * as MediaModule from 'modules/media.module';
import * as RelationModule from 'modules/relation.module';
import { mediaRegistrationSchema } from './validators/profile.validator';
import { paginationSchema } from './validators/global.validator';
import { RelationType } from 'models/types';

export default class ProfileRoute implements IRoute {
  public path: string;
  public router: Router;
  public exRouter: Router;

  constructor(path: string) {
    this.path = path;
    const { router, exRouter } = getBaseRoute(RouterConfig.Profile);
    this.router = router;
    this.exRouter = exRouter;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(
      '/media',
      validate(paginationSchema),
      createController(async (req: IRequest) => {
        const {
          payload: { limit, offset, sort, ...query },
        } = req.context;
        const queryPayload: IQueryPayload = {
          query,
        };

        if (limit !== undefined && offset !== undefined) {
          queryPayload.pagination = {
            limit,
            offset,
          };
        }
        if (sort) {
          queryPayload.sort = sort;
        }

        const users = await MediaModule.getProfileMedias(req.context, queryPayload);

        return users;
      })
    );

    this.router.get(
      '/:relationType',
      validate(paginationSchema),
      createController(async (req: IRequest) => {
        const {
          payload: { limit, offset, sort, ...query },
        } = req.context;
        const queryPayload: IQueryPayload = {
          query,
        };

        if (limit !== undefined && offset !== undefined) {
          queryPayload.pagination = {
            limit,
            offset,
          };
        }
        if (sort) {
          queryPayload.sort = sort;
        }

        const type =
          req.params.relationType === 'flirts' ? RelationType.Flirt : RelationType.Favorite;

        const users = await RelationModule.getRelations(req.context, type, queryPayload);

        return users;
      })
    );

    this.router.post(
      '/media',
      isAuthenticated,
      createController(async (req: IRequest, res: any) => {
        const { fields, files } = await formidablePromise(req);
        if (!files.file) {
          return createError(StatusCode.BAD_REQUEST, 'file field is required');
        }

        // validate
        const cusReq = {
          body: {
            ...fields,
            file: files.file as formidable.File,
          },
          context: {},
        } as any;
        await promisify(validate(mediaRegistrationSchema))(cusReq, res);

        const result = await MediaModule.uploadProfileMedia(req.context, cusReq.context.payload);
        return result;
      })
    );
  }
}