import * as dotenv from 'dotenv';
dotenv.config();

import App from './app';
import SystemRoute from 'routes/system.route';
import UsersRoute from 'routes/users.route';

(async () => {
  const app = new App('v1');

  await app.init(
    [
      // prettier-ignore
      new UsersRoute('users'),
      new SystemRoute('system'),
    ],
  );

  app.listen();
})();
