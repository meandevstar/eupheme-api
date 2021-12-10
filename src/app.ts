import express from 'express';
import methodOverride from 'method-override';
import { connect, disconnect, getConnection } from 'models';
import config from 'common/config';
import { ConnType, IAppContext, IRoute } from 'common/types';
import responseHandler from 'middlewares/response.middleware';
import corsHandler from 'middlewares/cors.middleware';
import * as SocketModule from 'modules/lib/socket.module';
import { Server } from 'http';

class App {
  public server: Server;
  public app: express.Application;
  public port: string | number;
  public env: boolean;
  public version: string;

  constructor(version: string) {
    this.version = version;
  }

  public async init(routes: IRoute[], isCron?: boolean) {
    this.port = config.port;
    this.env = process.env.NODE_ENV === 'production' ? true : false;

    const bgContext = await this.preprocess(isCron);

    if (!isCron) {
      this.app = express();
      this.app.use(express.json());
      this.initMiddlewares(bgContext);
      this.initRoutes(routes);
      this.app.use(responseHandler);
      process.on('SIGINT', this.exitHandler.bind(null, { exit: true }));
    }
  }

  public listen() {
    this.server = this.app.listen(this.port, () => {
      console.log(`App listening on the port ${this.port}`);
    });
  }

  public getServer() {
    return this.app;
  }

  /**
   * Setup all middlewares for app
   */
  private initMiddlewares(bgContext: IAppContext) {
    this.app.set('trust proxy', true);

    this.app.use(methodOverride('X-HTTP-Method-Override'));
    this.app.use(corsHandler);
  }

  /**
   * Setup route for app
   * @param routes
   */
  private initRoutes(routes: IRoute[]) {
    routes.forEach((route) => {
      this.app.use(`/${this.version}/${route.path}`, route.exRouter);
    });
  }

  /**
   * Create connection to MongoDB
   */
  public async preprocess(isCron?: boolean): Promise<IAppContext> {
    try {
      await connect();

      // create a background context , basically holds db connection for now
      const bgContext: IAppContext = {
        conn: getConnection(ConnType.Default),
      };

      SocketModule.initialize(bgContext);

      return bgContext;
    } catch (error) {
      console.error(error);
    }
  }

  public async exitHandler(options: { exit: boolean; cleanup: boolean }, exitCode: number) {
    await Promise.all([SocketModule.closeSocketServer(), disconnect()]);

    if (this.server) {
      this.server.close();
    }
    process.exit(0);
  }
}

export default App;
