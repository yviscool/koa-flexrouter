
import * as methods from "methods";
import * as path from "path";

enum NodeType { DEFAULT, ROOT, PARAM, CATCHALL }

function split2(path, sep) {
    var res = path.split(sep);
    if (res.length == 1) {
        return res;
    }
    if (res[0] == '') {
        return ['', res.slice(1).join(sep)];
    }
    return [res[0], res.slice(1).join(sep)];
}

function countParams(path: string): number {
    let n = 0;
    const wildcards = [':', '*'];
    for (let i = 0; i < path.length; i++) {
        if (wildcards.indexOf(path[i]) < 0) {
            continue;
        }
        n++
    }
    if (n >= 255) {
        return 255
    }
    return n;
}

class Tree {

    path: string = "";
    // 分裂的所有分支第一个字符的相加值
    indices: string = "";
    children: Tree[] = [];
    handlers: Function[] = [];
    priority: number = 0;
    nType: NodeType = NodeType.DEFAULT;
    maxParams: number = 0;
    wildChild: boolean = false;

    constructor(partial: Partial<Tree>) {
        Object.assign(this, partial)
    }

    incrementChildPrio(pos: number) {

        let n: Tree = this;

        n.children[pos].priority++;

        let prio = n.children[pos].priority;

        let newPos = pos;

        for (; newPos > 0 && this.children[newPos - 1].priority < prio;) {

            [n.children[newPos - 1], n.children[newPos]] = [n.children[newPos], n.children[newPos - 1]]

            newPos--
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
        path = new Router().calculateAbsolutePath(path);
        let fullPath = path;
        const wildChilds = [':', '*'];
        if (n.path.length > 0 || n.children.length > 0) {

            walk: for (; ;) {
                if (numParams > n.maxParams) {
                    n.maxParams = numParams;
                }
                let i = 0
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
                    n.indices = n.path[i];
                    // 取出公共部分作为父级(如果没有公共部分，那么会是 '')
                    n.path = path.slice(0, i);
                    n.handlers = (null as any);
                    n.wildChild = false;
                }


                // 没有公共部分 或者 公共部分 小于 path 
                if (i < path.length) {

                    //n.path useryyyy
                    //path userxxxxx
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

                        throw new Error("'" + pathSeg +
                            "' in new path '" + fullPath +
                            "' conflicts with existing wildcard '" + n.path +
                            "' in existing prefix '" + prefix +
                            "'");
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

                    if (wildChilds.indexOf(c) < 0) {
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
        const wildcards = [':', '*'];
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
                n.priority++

                // second node: node holding the variable
                child = new Tree({
                    path: path.slice(i),
                    nType: NodeType.CATCHALL,
                    maxParams: 1,
                    handlers: middlewares,
                    priority: 1,
                })
                n.children = [child]

                return
            }

        }

        n.path = path.slice(offset);
        n.handlers = middlewares;

    }

    getValue() {

    }

    findCaseInsensitivePath() {

    }
}



// class MethodsTree {

//     method: string;

//     root: Tree;

//     constructor() {

//     }

// }

// declaration merging, merge rest verb 
interface Router {
    get(): Router;
    post(): Router;
    put(): Router;
    head(): Router;
    delete(): Router;
    options(): Router;
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
    patch(): Router;
    search();
    connect();
}


class Router {


    basePath: string;

    trees: Map<string, Tree>;

    constructor() {

        this.basePath = '/';
    }

    handle(method: string, path: string, ...middlewares: Function[]) {

        const absolutePath = this.calculateAbsolutePath(path);

        this.addRoute(method, absolutePath, middlewares)

    }

    calculateAbsolutePath(relativePath: string): string {

        if (relativePath == '') {
            return this.basePath;
        }

        const finalPath = path.join(this.basePath, relativePath);
        // 计算出绝对路径  basePath + relativePath =>   /bash/xxxx (如果relativePath以/结尾,那么 xxx后面也会以/结尾)
        const appendSlash = relativePath.slice(-1) == '/' && finalPath.slice(-1) != '/';

        if (appendSlash) {
            return finalPath + '/';
        }
        return finalPath;
    }

    addRoute(httpMethod: string, absolutePath: string, middlewares: Function[]) {

    }

}


(methods as string[]).forEach(method => {

    Router.prototype[method] = function (path: string, ...middlewares: Function[]) {

        this.handle(method, path, ...middlewares);

        return this;

    }
})




var tree = new Tree({ path: '' })


tree.addRoute('/users/:id/courses/:courseId', function () { }, function () { })
// tree.addRoute('/usersixl/:id/courses/:courseId', function () { }, function () { })
tree.addRoute('/teachers/:id/ixl', function () { }, function () { })
tree.addRoute('/teaixl/:id/ixl', function () { }, function () { })   

console.log(tree);


// handlers, params, tsr := root.getValue(rPath, c.Params, unescape)