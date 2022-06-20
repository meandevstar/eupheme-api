import { Router } from 'express';
import { createController, getBaseRoute } from 'common/utils';
import { IRequest, IRoute, RouterConfig } from 'common/types';
import isAuthenticated from 'middlewares/auth.middleware';
import validate from 'middlewares/validate.middleware';
import * as RelationModule from 'modules/relation.module';
import { relationCreateSchema } from './validators/relation.valudator';

export default class RelationRoute implements IRoute {
  public path: string;
  public router: Router;
  public exRouter: Router;

  constructor(path: string) {
    this.path = path;
    const { router, exRouter } = getBaseRoute(RouterConfig.Relation);
    this.router = router;
    this.exRouter = exRouter;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      '/',
      isAuthenticated,
      validate(relationCreateSchema),
      createController(async (req: IRequest, res: any) => {
        const { type, user: userId } = req.context.payload;
        const result = await RelationModule.createRelation(req.context, userId, type);

        return result;
      })
    );
  }
}
