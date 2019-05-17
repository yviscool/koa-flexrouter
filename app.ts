
import * as methods from "methods";
import * as compose from "koa-compose";
import * as path from "path";
import * as util from "util";
import * as Koa from "koa";
import * as Debug from "debug";

const debug = Debug('router');


enum NodeType { DEFAULT, ROOT, PARAM, CATCHALL }

const wildcards = [':', '*'];

function split2(path: string, sep: string): string[] {
    var res = path.split(sep);
    return res.length == 1 ? res : [res[0], res.slice(1).join(sep)];
}

function countParams(path: string): number {
    let n = 0;
    for (let i = 0; i < path.length; i++) {
        if (wildcards.indexOf(path[i]) < 0) {
            continue;
        }
        n++;
    }
    if (n >= 255) {
        return 255;
    }
    return n;
}

class Tree {

    path: string = "";
    // 分裂的所有分支第一个字符的相加值, 每个字符的索引对应 children 的索引，方便快速找到分支
    indices: string = "";
    children: Tree[] = [];
    handlers: Function[] = [];
    priority: number = 0;
    nType: NodeType = NodeType.DEFAULT;
    maxParams: number = 0;
    wildChild: boolean = false;

    constructor(partial?: Partial<Tree>) {
        Object.assign(this, partial)
    }

    incrementChildPrio(pos: number) {

        let n: Tree = this;

        n.children[pos].priority++;

        let prio = n.children[pos].priority;

        let newPos = pos;

        for (; newPos > 0 && this.children[newPos - 1].priority < prio;) {

            [n.children[newPos - 1], n.children[newPos]] = [n.children[newPos], n.children[newPos - 1]]

            newPos--;
        }
        if (newPos != pos) {
            n.indices = n.indices.slice(0, newPos)
                + n.indices.slice(pos, pos + 1)
                + n.indices.slice(newPos, pos)
                + n.indices.slice(pos + 1)
        }

        return newPos;
    }

    addRoute(path: string, ...middlewares: Function[]) {
        this.priority++;
        let n: Tree = this;
        let numParams = countParams(path);
        // path = new Router().calculateAbsolutePath(path);
        let fullPath = path;
        if (n.path.length > 0 || n.children.length > 0) {

            walk: while (true) {
                if (numParams > n.maxParams) {
                    n.maxParams = numParams;
                }
                let i = 0;
                let max = Math.min(path.length, n.path.length);

                // 找到 path 和 n.path 的公共值 索引
                for (; i < max && path[i] == n.path[i];) {
                    i++;
                }

                // 没有公共部分，或者 公共部分 小于 n.path
                if (i < n.path.length) {
                    // 开始分裂，比如一开始path是user，新来了useradd，user是他们匹配的部分，
                    // 那么会将user拿出来作为parent节点，

                    // 截取出非公共部分
                    let child = new Tree({
                        path: n.path.slice(i),
                        wildChild: n.wildChild,
                        indices: n.indices,
                        children: n.children,
                        handlers: n.handlers,
                        priority: n.priority - 1
                    });

                    child.children.forEach(tree => {
                        if (tree.maxParams > child.maxParams) {
                            child.maxParams = tree.maxParams
                        }
                    })

                    n.children = [child];
                    // 取出非公共部分的首字母
                    n.indices = n.path[i];
                    // 取出公共部分作为父级(如果没有公共部分，那么会是 '')
                    n.path = path.slice(0, i);
                    n.handlers = (null as any);
                    n.wildChild = false;
                }


                // 没有公共部分 或者 公共部分 小于 path 
                if (i < path.length) {

                    // 提取出非公共部分
                    path = path.slice(i);
                    if (n.wildChild) {
                        n = n.children[0];
                        n.priority++;

                        if (numParams > n.maxParams) {
                            n.maxParams = numParams;
                        }
                        numParams--;
                        // Check if the wildcard matche
                        if (path.length >= n.path.length && n.path == path.slice(0, n.path.length)) {
                            // check for longer wildcard, e.g. :name and :names
                            if (n.path.length >= path.length || path[n.path.length] == '/') {
                                continue walk;
                            }
                        }

                        let pathSeg = path;
                        if (n.nType != NodeType.CATCHALL) {
                            pathSeg = split2(path, '/')[0];
                        }
                        let prefix = fullPath.slice(0, fullPath.indexOf(pathSeg)) + n.path;

                        throw new Error(`${pathSeg} in new path ${fullPath} conflicts with existing wildcard ${n.path} in existing prefix ${prefix}`);
                    }

                    let c = path[0];

                    if (n.nType == NodeType.PARAM && c == '/' && n.children.length == 1) {
                        n = n.children[0];
                        n.priority++;
                        continue walk;
                    }

                    for (let i = 0; i < n.indices.length; i++) {
                        if (c == n.indices[i]) {
                            i = n.incrementChildPrio(i);
                            n = n.children[i];
                            continue walk;
                        }
                    }

                    if (wildcards.indexOf(c) < 0) {
                        n.indices += c;
                        let child = new Tree({
                            maxParams: numParams
                        });
                        n.children.push(child);
                        n.incrementChildPrio(n.indices.length - 1);
                        n = child;
                    }

                    n.insertChild(numParams, path, middlewares);
                    return;
                } else if (i == path.length) {
                    if (n.handlers != null) {
                        throw new Error('handlers are already registerd for path' + fullPath);
                    }
                    n.handlers = middlewares;
                }
                return;
            }

        } else {
            n.insertChild(numParams, path, middlewares)
            n.nType = NodeType.ROOT;
        }
    }

    insertChild(numParams: number, path: string, middlewares: Function[]) {

        let n: Tree = this;
        let offset = 0;

        const fullPath = path;
        for (let [i, max] = [0, path.length]; numParams > 0; i++) {

            let c = path[i];

            if (wildcards.indexOf(c) < 0) {
                continue;
            }

            let end = i + 1;
            // 找到未知数第一次以 / 结尾的，该段区间内不能重复有 * / :
            while (end < max && path[end] != '/') {
                if (wildcards.indexOf(path[end]) > 0) {
                    throw new Error(`only one wildcard per path segment is allowed, has: ${path.slice(i)} in path ${fullPath}`);
                }
                end++;
            }

            if (n.children.length > 0) {
                throw new Error(`wildcard route ${path.slice(i, end)} conflicts with existing children in path ${fullPath}`);
            }
            // /:/xjl 未知数必须要有名字
            if (end - i < 2) {
                throw new Error(`wildcards must be named with a non-empty name in path ${fullPath}`);
            }

            if (c == ':') {

                if (i > 0) {
                    n.path = path.slice(offset, i);
                    offset = i;
                }

                let child = new Tree({
                    nType: NodeType.PARAM,
                    maxParams: numParams
                });
                n.children = [child];
                n.wildChild = true;

                n = child;
                n.priority++;
                numParams--;

                // 说明 : 后面还有子路由  /:id/xxxx
                if (end < max) {
                    n.path = path.slice(offset, end);
                    offset = end;

                    child = new Tree({
                        maxParams: numParams,
                        priority: 1,
                    });

                    n.children = [child];
                    n = child;
                }

            } else {
                if (end != max || numParams > 1) {
                    throw new Error(`catch-all routes are only allowed at the end of the path in path ${fullPath}`)
                }

                if (n.path.length > 0 && n.path.slice(-1) == '/') {
                    throw new Error(`catch-all conflicts with existing handle for the path segment root in path ${fullPath}`)
                }

                // currently fixed width 1 for '/'
                i--;
                if (path[i] != '/') {
                    throw new Error(`no / before catch-all in path ${fullPath}`)
                }

                n.path = path.slice(offset, i);
                // first node: catchAll node with empty path
                let child = new Tree({
                    wildChild: true,
                    nType: NodeType.CATCHALL,
                    maxParams: 1,
                })
                n.children = [child];
                n.indices = path[i];
                n = child;
                n.priority++;

                // second node: node holding the variable
                child = new Tree({
                    path: path.slice(i),
                    nType: NodeType.CATCHALL,
                    maxParams: 1,
                    handlers: middlewares,
                    priority: 1,
                })
                n.children = [child]

                return;
            }

        }
        n.path = path.slice(offset);
        n.handlers = middlewares;

    }

    getValue(path: string, params: any = {}) {
        let p = params;
        let n: Tree = this;
        let handlers = null;
        let tsr;
        walk: for (; ;) {
            if (path.length > n.path.length) {
                if (path.slice(0, n.path.length) == n.path) {
                    path = path.slice(n.path.length);

                    if (!n.wildChild) {
                        let c = path[0];

                        for (let i = 0; i < n.indices.length; i++) {
                            if (c == n.indices[i]) {
                                n = n.children[i]
                                continue walk;
                            }
                        }

                        tsr = path == '/' && n.handlers != null;
                        return { handlers, tsr, params: p }
                    }

                    n = n.children[0];

                    if (n.nType == NodeType.PARAM) {

                        let end = 0;
                        for (; end < path.length && path[end] != '/';) {
                            end++;
                        }

                        p[n.path.slice(1)] = path.slice(0, end);

                        if (end < path.length) {
                            if (n.children.length > 0) {
                                path = path.slice(end);
                                n = n.children[0];
                                continue walk;
                            }

                            // 
                            tsr = path.length == end + 1;
                            return { handlers, tsr, params: p }
                        }
                        handlers = n.handlers as any;
                        if (handlers != null) {
                            return { handlers, tsr, params: p }
                        }

                        if (n.children.length == 1) {
                            n = n.children[0];
                            tsr = n.path == '/' && n.handlers != null;
                        }

                        return { handlers, tsr, params: p }

                    } else if (n.nType == NodeType.CATCHALL) {

                        p[n.path.slice(2)] = path;
                        handlers = n.handlers as any;

                        return { handlers, tsr, params: p }

                    } else {

                        throw new Error('invalid node type');

                    }

                }
            } else if (path == n.path) {
                handlers = n.handlers as any;
                if (handlers != null) {
                    return { handlers, tsr, params: p }
                }
                if (path == '/' && n.wildChild && n.nType != NodeType.ROOT) {
                    tsr = true;
                    return { handlers, tsr, params: p }
                }

                for (let i = 0; i < n.indices.length; i++) {
                    if (n.indices[i] == '/') {
                        n = n.children[i]
                        tsr = (n.path.length == 1 && n.handlers != null) ||
                            (n.nType == NodeType.CATCHALL && n.children[0].handlers != null)
                        return { handlers, tsr, params: p }
                    }
                }

                return { handlers, tsr, params: p }
            }

            tsr = (path == '/') || (n.path.length == path.length + 1 && n.path[path.length] == '/' && path == n.path.slice(0, n.path.length - 1) && n.handlers != null)
            return { handlers, tsr, params: p }
        }
    }

    // findCaseInsensitivePath() { }
}


// declaration merging, merge rest verb 
interface Router {
    get(basePath: string, ...middleware: Array<Function>): Router;
    post(basePath: string, ...middleware: Array<Function>): Router;
    put(basePath: string, ...middleware: Array<Function>): Router;
    head(basePath: string, ...middleware: Array<Function>): Router;
    delete(basePath: string, ...middleware: Array<Function>): Router;
    options(basePath: string, ...middleware: Array<Function>): Router;
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
    patch(basePath: string, ...middleware: Array<Function>): Router;
    search();
    connect();
}


class Router {

    basePath: string = '/';

    defaultHandlers: Function[] = [];

    trees: Map<string, Tree> = new Map();

    constructor(partial?: Partial<Router>) {
        Object.assign(this, partial);
    }

    group(partial?: Partial<Router>): Router {
        return new Router({
            ...partial,
            trees: this.trees
        });
    }

    handle(method: string, path: string, ...middlewares: Function[]) {

        const absolutePath = this.calculateAbsolutePath(path);

        middlewares = [...this.defaultHandlers, ...middlewares];

        let tree = this.trees.get(method);

        if (!tree) {
            tree = new Tree();
            this.trees.set(method, tree);
        }

        tree.addRoute(absolutePath, ...middlewares);

    }



    calculateAbsolutePath(relativePath: string): string {

        if (relativePath == '') {
            return this.basePath;
        }

        const finalPath = path.join(this.basePath, relativePath);
        // 计算出绝对路径  basePath + relativePath =>   /bash/xxxx (如果relativePath以/结尾,那么 xxx后面也会以/结尾)
        const appendSlash = relativePath.slice(-1) == '/' && finalPath.slice(-1) != '/';

        return appendSlash ? finalPath + '/' : finalPath;

    }

    routes(): Function {

        const router = this;

        return function dispatch(ctx, next) {

            debug('%s %s', ctx.method, ctx.path)

            const { params, handlers } = router.match(ctx.path, ctx.method);

            if (!handlers) return next();

            ctx.params = params;

            return compose(handlers as any)(ctx, next);

        }

    }

    match(path, method) {
        const tree = this.trees.get(method);
        return tree ? tree.getValue(path) : { params: {}, handlers: null }
    }
}


(methods as string[]).forEach(method => {

    Router.prototype[method] = function (path: string, ...middlewares: Function[]) {

        this.handle(method.toLocaleUpperCase(), path, ...middlewares);

        return this;

    }
})




var router = new Router();

var userRouter = router.group({ 
    basePath: '/users' ,
    defaultHandlers: [
        async function (ctx, next){

            console.log('ahah')

            return next();
        }

    ]
})

// var resourceRouter = router.group({ basePath: '/resources' })

userRouter
    .get('/:id/courses/*action', async (ctx, next) => { 
        ctx.body = ctx.params;
    })
    .post('/:id/course/*action', async (ctx, next) => {
        ctx.body = ctx.params;
     })

// resourceRouter
//     .get('/:id', async (ctx, next) => { })


// var tree = new Tree({ path: '' })



// router.get('/users/:id', async (ctx, next) => { return next() }, async (ctx, next) => {
    

//     ctx.body = ctx.params;

// })
// router.get('/users/:id/resource', function () { }, function () { })
// // tree.addRoute('/usersixl/:id/courses/:courseId', function () { }, function () { })
// tree.addRoute('/teachers/:id/ixl', function () { }, function () { })
// tree.addRoute('/teaixl/:id/ixl/', function () { }, function () { })

debug(util.inspect(router.trees, { showHidden: false, depth: null }))

// var a = tree.getValue('/teaixl/123/ixl/456/zjl', {});

var koa = new Koa();

koa.use(router.routes() as any)


koa.listen(3000)
