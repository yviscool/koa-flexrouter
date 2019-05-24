
import * as methods from "methods";
import * as compose from "koa-compose";
import * as path from "path";
import * as util from "util";
import { Middleware } from "koa";
import * as Koa from "koa";

import Tree from "./tree";

const debug = require('debug')('router');

// declaration merging, merge rest verb 
interface Router {
    get(path: string, ...middleware: Array<Middleware>): Router;
    post(path: string, ...middleware: Array<Middleware>): Router;
    put(path: string, ...middleware: Array<Middleware>): Router;
    head(path: string, ...middleware: Array<Middleware>): Router;
    delete(path: string, ...middleware: Array<Middleware>): Router;
    options(path: string, ...middleware: Array<Middleware>): Router;
    patch(path: string, ...middleware: Array<Middleware>): Router;
    trace();
    copy();
    lock();
    mkcok();
    move();
    purge();
    profind();
    proppatch();
    unlock();
    report();
    mkactivity();
    checkout();
    merge();
    ['m-search']();
    notify();
    subscribe();
    unsubscribe();
    search();
    connect();
}

interface Value {
    handlers: Middleware[]|null,
    tsr: boolean,
    params: any
}


class Router {

    // bastpath
    path: string = '/';

    middlewares: Middleware[] = [];

    trees: Map<string, Tree> = new Map();

    redirectTrailingSlash: boolean = true;

    constructor(partial?: Partial<Router>) {
        Object.assign(this, partial);
    }

    // create sub router
    group(partial?: Partial<Router>): Router {
        return new Router({
            ...partial,
            trees: this.trees
        });
    }

    handle(method: string, path: string, ...middlewares: Middleware[]) {

        const absolutePath = this.calculateAbsolutePath(path);

        middlewares = [...this.middlewares, ...middlewares];

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

            debug('%s %s', ctx.method, ctx.path)

            const { params, handlers, tsr } = router.match(ctx.path, ctx.method);

            if (handlers) {

                ctx.params = params;

                return compose(handlers)(ctx, next);

            }

            if (ctx.method != "CONNECT" && ctx.path != "/") {

                    
                if (tsr && router.redirectTrailingSlash) {

                    let p = ctx.path;
                    
                    ctx.get
                    let prefix = path.normalize(ctx.request.headers["X-Forwarded-Prefix"] || '');

                    debug('%s %s',p, prefix)

                    if (prefix != '.') {
                        p = prefix + '/' + ctx.path;
                    }

                    let code = 301;

                    if (ctx.method != "GET") {
                        code = 307;
                    }

                    ctx.path = p + "/";

                    let length = p.length;

                    if (length > 1 && p.slice(-1) == '/') {
                        ctx.path = p.slice(0, length - 1);
                    }
                    ctx.status = code;
                    ctx.redirect(ctx.path);
                }
            }


            return next();

        }

    }



    match(path: string, method: string): Value {
        const tree = this.trees.get(method);
        return tree ? tree.getValue(path) : { params: {}, handlers: null, tsr: false }
    }
}


// create router verb  get post put delete 
(methods as string[]).forEach(method => {

    Router.prototype[method] = function (path: string, ...middlewares: Middleware[]):Router {

        this.handle(method.toLocaleUpperCase(), path, ...middlewares);

        return this;

    }
})



var router = new Router();

var userRouter = router.group({
    path: '/users',
    middlewares: [
        async function (ctx, next) {

            console.log('ahah')

            return next();
        }
    ]
})


router
    .get('/xxx/:id/zjl/:userId/', async (ctx, next) => {
        ctx.body = ctx.params;
    })
// .get('/xxx/:id/ixl/:userId', async (ctx, next) => {
//     ctx.body = ctx.params;
// })

// var resourceRouter = router.group({ basePath: '/resources' })

// .get('/xxx/:id/yyy', async (ctx, next) => {
//     ctx.body = ctx.params;
// })

// resourceRouter
//     .get('/:id', async (ctx, next) => { })


// router.get('/users/:id', async (ctx, next) => { return next() }, async (ctx, next) => {
// router.get('/users/:id/resource', function () { }, function () { })
// router.addRoute('/teachers/:id/ixl', function () { }, function () { })
// router.addRoute('/teaixl/:id/ixl/', function () { }, function () { })

// var pararms = tree.getValue('/teaixl/123/ixl/456/zjl', {});

debug(util.inspect(router.trees, { showHidden: false, depth: null }))

var app = new Koa();

app.use(router.routes())

app.listen(3000)


export default Router;