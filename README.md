# @lytical/app

a typescript api server library built for your express project, with dependency injection support and auto router registration

## features

- router handler dependency injection
- auto `app.use()` router registration
- use middleware, only for routes that require it

## getting started

install packages:

```bash
npm install @lytical/app @lytical/ioc express
```

after installing, configure your `tsconfig.json` file to enable decorators.

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

if this is a new project, we recommended the following project structure:

```
project
|- dist
|- src
|  |- middleware
|  |  |- my-middleware.ts
|  |  |- ...
|  |- routes
|  |  |- my-route.ts
|  |  |- ...
|  |- services
|  |  |- my-service.ts
|  |  |- ...
|  |- index.ts
|- .gitignore
|- package.json
|- tsconfig.json
```

for the above project structure:

- configure your `tsconfig.json` file.

```json
// tsconfig.json
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

- configure your `package.json` file to indicate where your routes are located.

```json
// package.json
{
  "main": "./{index.js,routes/**/*.js}"
}
```

a simple project template / example can be found in github (https://github.com/lytical/ts-app-example)

## usage

create your injectable service class(es) to implement the business logic.

```typescript
import { ioc_injectable } from '@lytical/ioc';

@ioc_injectable()
// src/services/example-svc.ts
export class example_svc {
  async get_message() {
    return 'Hello from example_svc!';
  }

  async get_data() {
    return { message: await this.get_message() };
  }
}
```

create your middleware classes

```typescript
// src/middleware/example-mw.ts
import type { Request, Response, NextFunction } from 'express';

import { ioc_inject } from '@lytical/ioc';
import { example_svc } from '../services/example-svc';

/**
 * Example middleware class
 * Use for middleware that requires dependency injection
 */
export class example_middleware_class {
  // inject your service(es) into the middleware class constructor
  constructor(
    @ioc_inject(example_svc) private readonly _example_svc: example_svc,
  ) {}

  // all middleware classes must implement a default() route handler
  async default(rqs: Request, rsp: Response, nxt: NextFunction) {
    console.debug('example middleware invoked');
    rsp.locals.example_middleware_data = await this._example_svc.get_data();
    // make sure to call nxt() to continue the request processing pipeline
    nxt();
  }
}
```

create your route handler(s)

```typescript
// src/routes/example.ts
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import {
  app_middleware_dependency,
  app_route,
  app_route_handler,
} from '@lytical/app';

import { ioc_inject } from '@lytical/ioc';
import { example_svc } from '../services/example-svc';
import { example_middleware_class } from '../middleware/example-mw';

/**
 * Example route class
 * Use for router class(es) for auto app.use() registration for routes; dependent middleware; and dependency injection
 */
@app_route({ route: '/example' })
export class example_route_class {
  // inject your service(es) into the router class constructor
  constructor(
    @ioc_inject(example_svc) private readonly _example_svc: example_svc,
  ) {}

  // implement your handler methods
  @app_route_handler({
    route: '/', // /example/
    http_method: ['GET'],
  })
  async get_handler(rqs: Request, rsp: Response, nxt: NextFunction) {
    rsp.json({ message: await this._example_svc.get_message() }).end();
  }

  @app_route_handler({
    http_method: ['POST', 'PUT'],
    route: '/', // /example/
    dependency: [
      // use only the middleware needed
      express.json(),
      app_middleware_dependency(example_middleware_class),
    ],
    // you may indicate an error handler middleware at the route level.
    // the default error handler will be used if not indicated here.
    error_handler: example_error_handler
  })
  post_handler(rqs: Request, rsp: Response, nxt: NextFunction) {
    rsp.json({ body: rqs.body, locals: rsp.locals }).end();
  }
}
```

now just import app and invoke `start()`

```typescript
// src/index.ts
import app from '@lytical/app';

app.start();
```

`app` emits a few life cycle events

```typescript
// src/index.ts
import app, { app_evt } from './lib/app';

// app events occur in the following order:
// 1. create_server
// 2. server_starting
// 3. server_listening
// 4. server_started

app.once(app_evt.create_server, (cfg) => {
  // modify (cfg) as needed, or remove this listener if not needed.
  // for example, create a https server instead of http,
  // and push async operations to fetch keys, to (cfg.wait_for).
  // add middleware to (cfg.express), that applies to all routes, etc.
  console.log(`the root route is (${cfg.root_route})`);
});

app.once(app_evt.server_starting, (cfg) => {
  // modify (cfg) as needed, or remove this listener if not needed.
  // add middleware to this application after auto registered routes are added.
  // for example error handling middleware, etc.
  // push async operations to fetch settings from a database, to (cfg.wait_for).
  // this is the last to register dependencies in the ioc collection before the server starts.
  console.log(`the hostname is (${cfg.hostname})`);
});

app.once(app_evt.server_listening, () => {
  // remove this listener if not needed.
  // use it to perform operations after the server starts listening.
  // the ioc container is ready at this point.
});

app.once(app_evt.server_started, () => {
  // remove this listener if not needed.
  // use it to perform operations after the server has started.
});

app.start();
```

## documentation

todo: working on this right now...

stay tuned! i have more packages to come.`

_lytical(r) is a registered trademark of lytical, inc. all rights are reserved._
