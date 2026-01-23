/* @preserve
  (c) 2025 lytical, inc. all rights are reserved.
  lytical(r) is a registered trademark of lytical, inc.
  please refer to your license agreement on the use of this file.
*/

import type { Server } from 'node:net';
import type { Application } from 'express';

/**
 * server configuration type
 * @description
 * the configuration used when creating or modifying the server before it is started.
 */
export type app_server_cfg_t = {
  /**
   * the express application instance
   * @description
   * the express application instance that will be used to create the server
   * add any middleware to this application before auto registered routes are added.
   */
  express: Application;

  /**
   * the root route
   * @description
   * override and provide the root route to be used. if not provided, the default '/api' route will be used.
   */
  root_route: string;

  /**
   * the server instance
   * @description
   * provide the server instance to be used. if not provided, a default http server will be created. 
   */
  server?: Server;

  /**
   * wait_for
   * @description
   * can be used to delay until some asynchronous operation is complete.
   */
  wait_for: Promise<any>[];
};

/**
 * listening configuration type
 * @description
 * the configuration used when starting the server listening.
 */
export type app_listening_cfg_t = {
  /**
   * the maximum length of the queue of pending connections
   * @description
   * provide the maximum length of the queue of pending connections. the default is 511 (node.js default).
   */
  backlog?: number;

  /**
   * the express application instance
   * @description
   * add any middleware to this application after auto registered routes are added.
   */
  express: Application;

  /**
   * the hostname to listen on
   * @description
   * provide the hostname to listen on. if not provided, the server will listen on all available interfaces.
   */
  hostname?: string;

  /**
   * the port to listen on
   * @description
   * provide the port to listen on. if not provided, the server will listen on port process.env.PORT or 3000.
   */
  port?: number;

  /**
   * the server instance
   * @description
   * the server instance that will be used.
   * use to add listeners before the server is started.
   */
  server: Server;

  /**
   * wait_for
   * @description
   * can be used to delay until some asynchronous operation is complete.
   * */
  wait_for: Promise<any>[];
};