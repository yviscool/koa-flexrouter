
import * as methods from 'methods';
import * as compose from 'koa-compose';
import * as path from 'path';
import { Middleware } from 'koa';
import * as DEBUG from 'debug';

import { Tree, Value, CaseInsensitiveValue } from './tree';

const debug = DEBUG('router');

// declaration merging, merge rest verb
interface Router {
    get(path: string, ...middleware: Middleware[]): Router;
    post(path: string, ...middleware: Middleware[]): Router;
    put(path: string, ...middleware: Middleware[]): Router;
    head(path: string, ...middleware: Middleware[]): Router;
    delete(path: string, ...middleware: Middleware[]): Router;
    del(path: string, ...middleware: Middleware[]): Router;
    options(path: string, ...middleware: Middleware[]): Router;
    patch(path: string, ...middleware: Middleware[]): Router;
    link(path: string, ...middleware: Middleware[]): Router;
    unlink(path: string, ...middleware: Middleware[]): Router;
}

class Router {

    // bastpath
    path: string = '/';

    middlewares: Middleware[] = [];

    trees: Map<string, Tree> = new Map();

    // trailing slash  for redirect
    redirectTrailingSlash: boolean = true;

    // CaseInsensitive for redirect
    redirectFixedPath: boolean = false;

    constructor(partial?: Partial<Router>) {
        Object.assign(this, partial);
    }

    // create sub router
    group(partial?: Partial<Router>): Router {
        return new Router({
            ...partial,
            trees: this.trees,
            redirectFixedPath: this.redirectFixedPath,
        });
    }

    handle(method: string, path: string, ...middlewares: Middleware[]) {

        const absolutePath = this.calculateAbsolutePath(path);

        middlewares = [ ...this.middlewares, ...middlewares ];

        let tree = this.trees.get(method);

        if (!tree) {
            tree = new Tree();
            this.trees.set(method, tree);
        }

        tree.addRoute(absolutePath, middlewares);

    }

    calculateAbsolutePath(relativePath: string): string {

        if (relativePath == '') {
            return this.path;
        }

        const finalPath = path.join(this.path, relativePath);
        // 计算出绝对路径  basePath + relativePath =>   /bash/xxxx (如果relativePath以/结尾,那么 xxx后面也会以/结尾)
        const appendSlash = relativePath.slice(-1) == '/' && finalPath.slice(-1) != '/';

        return appendSlash ? finalPath + '/' : finalPath;

    }

    routes(): Middleware {

        const router = this;

        return function dispatch(ctx, next) {

            debug('%s %s', ctx.method, ctx.path);

            const { params, handlers, tsr } = router.match(ctx.path, ctx.method);

            if (handlers) {

                ctx.params = params;

                return compose(handlers)(ctx, next);

            }

            if (ctx.method != 'CONNECT' && ctx.path != '/') {

                const code = ctx.method != 'GET' ? 307 : 301;

                if (tsr && router.redirectTrailingSlash) {

                    let p = ctx.path;

                    const prefix = path.normalize(ctx.headers['x-forwarded-prefix'] || '');

                    debug('%s %s', p, prefix);

                    if (prefix != '.') {
                        p = prefix + '/' + ctx.path;
                    }

                    ctx.path = p + '/';

                    const length = p.length;

                    if (length > 1 && p.slice(-1) == '/') {
                        ctx.path = p.slice(0, length - 1);
                    }

                    ctx.status = code;
                    ctx.redirect(ctx.path);

                } else if (router.redirectFixedPath) {

                    const { ciPath, found } = router.findFixedPath(path.normalize(ctx.path), ctx.method);

                    if (found) {
                        ctx.status = code;
                        ctx.redirect(ciPath);
                    }

                }

            }

            return next();

        };

    }

    match(path: string, method: string): Value {
        const tree = this.trees.get(method);

        return tree ? tree.getValue(path) : { params: null, handlers: null, tsr: false };
    }

    findFixedPath(path: string, method: string): CaseInsensitiveValue {
        const tree = this.trees.get(method);

        return tree ? tree.findCaseInsensitivePath(path, true) : { ciPath: null, found: false };
    }
}

// create router verb  get post put delete
(methods as string[]).forEach(method => {

    Router.prototype[method] = function (path: string, ...middlewares: Middleware[]): Router {

        this.handle(method.toLocaleUpperCase(), path, ...middlewares);

        return this;

    };
});

Router.prototype.del = Router.prototype.delete;

export default Router;
