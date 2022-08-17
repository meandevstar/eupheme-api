import { Router, Response, NextFunction } from 'express';
import { ConnType, IRequest, RouterConfig } from 'common/types';
import { getConnection } from 'models';

/**
 * Return injected router
 *
 * The reason we define this separately is to inject contexts
 * after all custom middlewares like authentication, validations
 *
 * @param routeKey   module route key
 *
 */

// TODO: move to routes directory for compile order
export function getBaseRoute(routeKey: RouterConfig) {
  const exRouter: any = Router();
  const router: any = {};
  const methods = ['get', 'post', 'put', 'patch', 'delete'];

  // inject context for module route
  function injectContext(req: IRequest, res: Response, next: NextFunction) {
    // get db connection for module route - use default connection if not defined
    const conn = getConnection(((routeKey as unknown) as ConnType) || ConnType.Default);

    req.context = { conn };
    next();
  }

  for (const method of methods) {
    router[method] = (route: string, ...params: any) => {
      const handler = params.pop();
      exRouter[method](route, injectContext, ...params, handler);
    };
  }

  return {
    exRouter,
    router,
  };
}
