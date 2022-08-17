import { Router } from 'express';
import formidable from 'formidable';
import fs from 'fs';
import { createController, createError, formidablePromise, getBaseRoute } from 'common/utils';
import { IRequest, IRoute, RouterConfig, StatusCode } from 'common/types';
import isAuthenticated from 'middlewares/auth.middleware';
import { uploadFile } from 'modules/lib/s3.module';

export default class SystemRoute implements IRoute {
  public path: string;
  public router: Router;
  public exRouter: Router;

  constructor(path: string) {
    this.path = path;
    const { router, exRouter } = getBaseRoute(RouterConfig.Default);
    this.router = router;
    this.exRouter = exRouter;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(
      '/status',
      createController(async () => {
        return 'OK';
      })
    );

    this.router.get(
      '/info',
      createController(async () => {
        return {
          time: Date.now(),
        };
      })
    );

    this.router.post(
      '/upload-file',
      isAuthenticated,
      createController(async (req: IRequest) => {
        const { fields, files } = await formidablePromise(req);
        if (!files.file) {
          return createError(StatusCode.BAD_REQUEST, 'file field is required');
        }

        const uploadPath = `${fields.dir || 'images'}/file_${Date.now()}`;
        const buf = fs.readFileSync((files.file as formidable.File).filepath);
        const fileUrl = await uploadFile(
          buf,
          (files.file as formidable.File).mimetype,
          uploadPath,
          JSON.parse(fields.private as string || 'false'),
        );

        return fileUrl;
      })
    );
  }
}
