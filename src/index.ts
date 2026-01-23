/* @preserve
  (c) 2025 lytical, inc. all rights are reserved.
  lytical(r) is a registered trademark of lytical, inc.
  please refer to your license agreement on the use of this file.
*/

import { createServer } from 'node:http';
import { EventEmitter } from 'node:stream';
import { glob } from 'node:fs/promises';
import { join } from 'node:path';

import express, {
  type Request,
  type RequestHandler,
  type Response,
  type NextFunction,
} from 'express';

import findRoot from 'find-root';

import type { app_listening_cfg_t, app_server_cfg_t } from './types';

import { ioc_create_instance, ioc_invoke_method } from '@lytical/ioc';
import ioc_collection from '@lytical/ioc/collection';

/** events emitted by the app */
export enum app_evt {
  /**
   * use to create or modify the server before it is started
   *
   * for example, create a https server instead of http,
   * and push async operations to fetch keys, to (cfg.wait_for).
   * add middleware to (cfg.express), that applies to all routes, etc.
   */
  create_server = 'lyt-create-server',
  /**
   * use to modify the server listening configuration before it is started
   *
   * add middleware to this (cfg.express) after auto registered routes are added.
   * for example error handling middleware, etc.
   * push async operations to fetch settings from a database, to (cfg.wait_for).
   * this is the last to register dependencies in the ioc collection before the server starts.
   */
  server_starting = 'lyt-server-starting',
  /**
   * emitted when the server is listening
   *
   * use it to perform operations after the server starts listening.
   * the ioc container is ready at this point.
   */
  server_listening = 'lyt-server-listening',
  /**
   * emitted when the server has started
   *
   * use it to perform operations after the server has started.
   */
  server_started = 'lyt-server-started',
}

const _app = express();
const _root_route = express.Router({
  mergeParams: true,
});

/**
 * app class
 * @description
 * the main app class
 * @emits app_evt.create_server use to create or modify the server before it is started
 * @emits app_evt.server_starting use to modify the server listening configuration before it is started
 * @emits app_evt.server_listening emitted when the server is listening
 * @emits app_evt.server_started emitted when the server has started
 */
export class app extends EventEmitter {
  override once(
    event: app_evt.create_server,
    listener: (cfg: app_server_cfg_t) => void,
  ): this;
  override once(event: app_evt.server_listening, listener: () => void): this;
  override once(
    event: app_evt.server_starting,
    listener: (cfg: app_listening_cfg_t) => void,
  ): this;
  override once(event: app_evt.server_started, listener: () => void): this;
  override once(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this {
    return super.once(event, listener);
  }

  /**
   * start the app
   * @description
   * starts the express app server
   * app events occur in the following order:
   *   1. create_server
   *   2. server_starting
   *   3. server_listening
   *   4. server_started
   */
  async start() {
    // create server
    const svr_cfg: app_server_cfg_t = {
      express: _app,
      root_route: '/api',
      wait_for: [],
    };

    svr_cfg.express.use((_rqs, rsp, next) => {
      rsp.set(
        'X-Powered-By',
        'powered by lytical(r) enterprise solutions, and express',
      );
      rsp.set('X-Lyt-Version', '1.0.0');
      next();
    });

    console.log('[@lytical/ts-express] creating http server...');
    this.emit(app_evt.create_server, svr_cfg);
    if (svr_cfg.wait_for.length) {
      await Promise.all(svr_cfg.wait_for);
    }

    _app.use(svr_cfg.root_route ?? '/api', _root_route);

    const svr = svr_cfg.server ?? createServer(svr_cfg.express);

    await _register_routes();

    const listening_cfg: app_listening_cfg_t = {
      express: svr_cfg.express,
      hostname: process.env['HOSTNAME'] || 'localhost',
      port: process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000,
      server: svr,
      wait_for: [],
    };

    this.emit(app_evt.server_starting, listening_cfg);
    if (listening_cfg.wait_for.length) {
      await Promise.all(listening_cfg.wait_for);
    }

    await ioc_collection.create_container();

    svr.listen(
      listening_cfg.port,
      listening_cfg.hostname,
      listening_cfg.backlog,
      () => {
        this.emit(app_evt.server_listening);
        console.log(
          `[@lytical/ts-express] server started on port ${listening_cfg.port}; hostname ${listening_cfg.hostname}`,
        );
      },
    );

    this.emit(app_evt.server_started);
  }
}

async function _register_routes() {
  const { main } =
    (await import(join(findRoot(__dirname), 'package.json'))) ?? {};
  if (main) {
    const modules = await glob(main);
    const cwd = process.cwd();
    for await (const module of modules) {
      console.log(
        `[@lytical/ts-express] registering routes in module (${module})...`,
      );
      await import(join(cwd, module));
    }
  }
}

const route_handler_method: unique symbol = Symbol(
  'lyt-app-api-route-handler-method',
);

type cstor_t<_t_ = any> = new (...args: any[]) => _t_;

/**
 * helper to create a route handler dependency from a middleware class constructor
 * @param {app_route_middleware_t} cstor middleware class constructor
 * @param {unknown[]} arg optional arguments to append to the middleware constructor
 * @returns {app_route_handler_dependency_t} route handler dependency
 */
export function app_middleware_dependency(
  cstor: cstor_t<app_route_middleware_t>,
  ...arg: unknown[]
): app_route_handler_dependency_t {
  return { middleware: cstor, arg };
}

/**
 * app_route class decorator
 * @description
 * decorator to define a route class
 * support for dependency injection in the constructor
 * @param {app_route_info_t} route information
 */
export function app_route({ route, arg }: app_route_info_t) {
  const base_route = route;
  return (cstr: cstor_t) => {
    const router = express.Router({ mergeParams: true });
    const metadata = cstr.prototype[route_handler_method] ?? {};
    for (const method_nm of Object.keys(metadata)) {
      const {
        route,
        dependency,
        http_method,
      }: app_route_handler_info_normalized_t = metadata[method_nm];

      if (dependency.length || http_method.length > 1) {
        const method_router = express.Router({ mergeParams: true });
        const dep_nm: string[] = [];
        for (let dep of dependency) {
          if (typeof dep === 'function') {
            method_router.use(dep);
            dep_nm.push(dep.name || 'anonymous-middleware');
            continue;
          }
          const { middleware, arg } = dep;
          method_router.use((rqs, rsp, nxt) => {
            const inst = ioc_create_instance(middleware, ...(arg ?? []));
            return inst.default(rqs, rsp, nxt);
          });
          dep_nm.push(middleware.name || 'anonymous-middleware');
        }
        for (const method of http_method) {
          if ((method_router as any)[method.toLowerCase()]) {
            (method_router as any)[method.toLowerCase()](
              route,
              (rqs: Request, rsp: Response, nxt: NextFunction) => {
                const inst = ioc_create_instance(cstr, ...(arg ?? []));
                ioc_invoke_method(inst[method_nm], inst, rqs, rsp, nxt);
              },
            );
          } else {
            method_router.use(
              route,
              (rqs: Request, rsp: Response, nxt: NextFunction) => {
                if (method.toUpperCase() !== rqs.method) {
                  return nxt();
                }
                const inst = ioc_create_instance(cstr, ...(arg ?? []));
                ioc_invoke_method(inst[method_nm], inst, rqs, rsp, nxt);
              },
            );
          }
        }
        console.debug(
          `[@lytical/ts-express] registered (${http_method}:${base_route}${route}) route handler (${cstr.name}.${method_nm}) with dependencies (${dep_nm})`,
        );
        router.use(method_router);
        continue;
      }
      const [method] = http_method;
      if (method) {
        if ((router as any)[method.toLowerCase()]) {
          (router as any)[method.toLowerCase()](
            route,
            (rqs: Request, rsp: Response, nxt: NextFunction) => {
              const inst = ioc_create_instance(cstr, ...(arg ?? []));
              ioc_invoke_method(inst[method_nm], inst, rqs, rsp, nxt);
            },
          );
        } else {
          router.use(
            route,
            (rqs: Request, rsp: Response, nxt: NextFunction) => {
              if (method.toUpperCase() !== rqs.method) {
                return nxt();
              }
              const inst = ioc_create_instance(cstr, ...(arg ?? []));
              ioc_invoke_method(inst[method_nm], inst, rqs, rsp, nxt);
            },
          );
        }
        console.debug(
          `[@lytical/ts-express] registered (${method}:${base_route}${route}) route handler (${cstr.name}.${method_nm})`,
        );
        continue;
      }
      router.use(route, (rqs: Request, rsp: Response, nxt: NextFunction) => {
        const inst = ioc_create_instance(cstr, ...(arg ?? []));
        ioc_invoke_method(inst[method_nm], inst, rqs, rsp, nxt);
      });
      console.debug(
        `[@lytical/ts-express] registered (ALL-METHODS:${base_route}${route}) route handler (${cstr.name}.${method_nm})`,
      );
    }
    _root_route.use(route, router);
    return cstr;
  };
}

/**
 * app_route_handler method decorator
 * @param {app_route_handler_info_t} arg route handler information
 */
export function app_route_handler(arg: app_route_handler_info_t) {
  return (cstr: any, method_nm: string, pd: PropertyDescriptor) => {
    if (arg.dependency) {
      if (!Array.isArray(arg.dependency)) {
        arg.dependency = [arg.dependency];
      }
    } else {
      arg.dependency = [];
    }
    switch (typeof arg.http_method) {
      case 'undefined':
        arg.http_method = [];
        break;
      case 'string':
        arg.http_method = [arg.http_method];
        break;
    }
    const metadata = cstr[route_handler_method] ?? {};
    metadata[method_nm] = arg;
    cstr[route_handler_method] = metadata;
    return pd;
  };
}

/**
 * app_route_info_t
 * @description
 * route information for the app_route class decorator
 */
export type app_route_info_t = {
  /** the route path or pattern */
  route: string | RegExp;
  /** optional arguments to append to the route class constructor */
  arg?: unknown[];
};

/**
 * app_route_handler_dependency_t
 * @description
 * route handler dependency type
 * can be a RequestHandler or a middleware class constructor with optional arguments
 */
export type app_route_handler_dependency_t =
  | RequestHandler
  | {
      /** middleware class constructor */
      middleware: cstor_t<app_route_middleware_t>;
      /** optional arguments to append to the middleware constructor */
      arg?: unknown[];
    };

/**
 * app_route_handler_info_t
 * @description
 * route handler information for the app_route_handler method decorator
 */
export type app_route_handler_info_t = {
  /** route handler dependencies */
  dependency?:
    | app_route_handler_dependency_t
    | app_route_handler_dependency_t[];
  /** http method or methods */
  http_method?: string | string[];
  /** the route path or pattern */
  route: string | RegExp;
};

/**
 * app_route_middleware_t
 * @description
 * route middleware class type
 * the class must have a default method that is a RequestHandler
 * this method can be used as a middleware in the app_route_handler_info_t dependency property
 * this method can also have dependencies injected
 */
export interface app_route_middleware_t {
  /** the default method of the middleware class */
  default(rqs: Request, rsp: Response, nxt: NextFunction): void | Promise<void>;
}

type app_route_handler_info_normalized_t = {
  dependency: app_route_handler_dependency_t[];
  http_method: string[];
  route: string | RegExp;
};

export default new app();
