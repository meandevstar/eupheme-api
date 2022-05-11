import { Router } from 'express';
import { promisify } from 'util';
import formidable from 'formidable';
import { createController, createError, formidablePromise, getBaseRoute } from 'common/utils';
import { IRequest, IRoute, RouterConfig, StatusCode } from 'common/types';
import isAuthenticated from 'middlewares/auth.middleware';
import validate from 'middlewares/validate.middleware';
import * as MediaModule from 'modules/media.module';
import { mediaRegistrationSchema } from './validators/profile.validator';

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
      '/',
      createController(async () => {
        return 'OK';
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
