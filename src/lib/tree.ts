import { Middleware } from "koa";

enum NodeType { DEFAULT, ROOT, PARAM, CATCHALL }

export interface Value {
    handlers: Middleware[] | null,
    tsr: boolean,
    params: any
}

export interface CaseInsensitiveValue {
    ciPath: string,
    found: boolean;
}

const wildcards = [':', '*'];

function split2(path: string, sep: string): string[] {
    var res = path.split(sep);
    return res.length == 1 ? res : [res[0], res.slice(1).join(sep)];
}


// count `:` and `*` num
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

export class Tree {

    path: string = "";
    // 分裂的所有分支第一个字符的相加值, 每个字符的索引对应 children 的索引，方便快速找到分支
    indices: string = "";
    children: Tree[] = [];
    handlers: Middleware[] | null = null;
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

        while(newPos > 0 && n.children[newPos - 1].priority < prio) {

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

    addRoute(path: string, middlewares: Middleware[]) {
        this.priority++;
        let n: Tree = this;
        let numParams = countParams(path);

        const fullPath = path;

        if (n.path.length > 0 || n.children.length > 0) {

            walk: while (true) {
                if (numParams > n.maxParams) {
                    n.maxParams = numParams;
                }
                let i = 0;
                let max = Math.min(path.length, n.path.length);

                // Find the longest common index in `path` and `n.path`
                while (i < max && path[i] == n.path[i]) {
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
                            child.maxParams = tree.maxParams;
                        }
                    })

                    n.children = [child];
                    // 取出非公共部分的首字母
                    n.indices = n.path[i];
                    // 取出公共部分作为父级(如果没有公共部分，那么会是 '')
                    n.path = path.slice(0, i);
                    n.handlers = null;
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

                        throw new Error(`'${pathSeg}' in new path '${fullPath}' conflicts with existing wildcard '${n.path}' in existing prefix '${prefix}'`);
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

                    n.insertChild(numParams, path, fullPath, middlewares);

                    return;

                } else if (i == path.length) {
                    if (n.handlers != null) {
                        throw new Error(`handlers are already registerd for path '${fullPath}'`);
                    }
                    n.handlers = middlewares;
                }
                return;
            }

        } else {
            n.insertChild(numParams, path, fullPath, middlewares)
            n.nType = NodeType.ROOT;
        }
    }

    insertChild(numParams: number, path: string, fullPath: string, middlewares: Middleware[]) {

        let n: Tree = this;
        let offset = 0;

        for (let [i, max] = [0, path.length]; numParams > 0; i++) {

            let c = path[i];

            if (wildcards.indexOf(c) < 0) {
                continue;
            }

            let end = i + 1;

            // 找到未知数第一次以 / 结尾的，该段区间内不能重复有 * / :
            while (end < max && path[end] != '/') {
                if (wildcards.indexOf(path[end]) > 0) {
                    throw new Error(`only one wildcard per path segment is allowed, has: '${path.slice(i)}' in path '${fullPath}'`);
                }
                end++;
            }

            if (n.children.length > 0) {
                throw new Error(`wildcard route '${path.slice(i, end)}' conflicts with existing children in path '${fullPath}'`);
            }

            // /:/xjl 未知数必须要有命名
            if (end - i < 2) {
                throw new Error(`wildcards must be named with a non-empty name in path '${fullPath}'`);
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

                // *action must at  end of the path,  such as /*action/xxx is not allowed
                if (end != max || numParams > 1) {
                    throw new Error(`catch-all routes are only allowed at the end of the path in path '${fullPath}'`)
                }

                if (n.path.length > 0 && n.path.slice(-1) == '/') {
                    throw new Error(`catch-all conflicts with existing handle for the path segment root in path '${fullPath}'`)
                }

                // currently fixed width 1 for '/'
                i--;

                if (path[i] != '/') {
                    throw new Error(`no / before catch-all in path '${fullPath}'`)
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

    getValue(path: string, params: any = {}): Value {

        let n: Tree = this;

        let p = params;
        let tsr: boolean = false;
        let handlers: Middleware[] | null = null;

        walk: while (true) {
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
                        while (end < path.length && path[end] != '/') {
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

                        handlers = n.handlers;

                        if (handlers != null) {
                            return { handlers, tsr, params: p }
                        }

                        if (n.children.length == 1) {
                            n = n.children[0];
                            tsr = n.path == '/' && n.handlers != null;
                        }

                        return { handlers, tsr, params: p }

                    }

                    if (n.nType == NodeType.CATCHALL) {

                        p[n.path.slice(2)] = path;
                        handlers = n.handlers;

                        return { handlers, tsr, params: p }

                    }

                    throw new Error('invalid node type');

                }

            } else if (path == n.path) {

                handlers = n.handlers;

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

    findCaseInsensitivePath(path: string, fixTrailingSlash: boolean): CaseInsensitiveValue {
        let ciPath = '';
        let n: Tree = this;

        let found = false;

        while (path.length >= n.path.length && path.slice(0, n.path.length).toLocaleLowerCase() == n.path.toLocaleLowerCase()) {

            path = path.slice(n.path.length);
            ciPath = ciPath + n.path;

            if (path.length > 0) {

                if (!n.wildChild) {

                    let r = path[0].toLocaleLowerCase();


                    for (let i = 0; i < n.indices.length; i++) {

                        let indice = n.indices.charAt(i);

                        if (r == indice.toLocaleLowerCase()) {

                            let { ciPath: out, found } = n.children[i].findCaseInsensitivePath(path, fixTrailingSlash)

                            if (found) {
                                return { ciPath: ciPath + out, found: true }
                            }
                        }

                    }


                    found = fixTrailingSlash && path == "/" && n.handlers != null;

                    return { ciPath, found }
                }


                n = n.children[0];

                if (n.nType == NodeType.PARAM) {
                    let k = 0;
                    while (k < path.length && path[k] != '/') {
                        k++;
                    }

                    // add param value to case insensitive path
                    ciPath = ciPath + path.slice(0, k);

                    // we need to go deeper!
                    if (k < path.length) {
                        if (n.children.length > 0) {
                            path = path.slice(k);
                            n = n.children[0];
                            continue
                        }

                        // ... but we can't
                        if (fixTrailingSlash && path.length == k + 1) {
                            return { ciPath, found: true }
                        }
                        return { ciPath, found }
                    }

                    if (n.handlers != null) {
                        return { ciPath, found: true }
                    }

                    if (fixTrailingSlash && n.children.length == 1) {
                        // no handle found. check if a handle for this path + a
                        // trailing slash exists
                        n = n.children[0]
                        if (n.path == "/" && n.handlers != null) {
                            return { ciPath: ciPath + '/', found: true }
                        }
                    }
                    
                    return { ciPath, found };
                }

                if (n.nType == NodeType.CATCHALL) {
                    return { ciPath: ciPath + path, found: true }
                }

                throw ("invalid node type")
            } else {
                if (n.handlers != null) {
                    return { ciPath, found: true }
                }

                // no handle found.
                // try to fix the path by adding a trailing slash
                if (fixTrailingSlash) {
                    for (let i = 0; i < n.indices.length; i++) {
                        if (n.indices[i] == '/') {
                            n = n.children[i];
                            if ((n.path.length == 1 && n.handlers != null) || (n.nType == NodeType.CATCHALL && n.children[0].handlers != null)) {
                                return { ciPath: ciPath + '/', found: true }
                            }
                            return { ciPath, found };
                        }
                    }
                }
                return { ciPath, found };
            }


        }

        if (fixTrailingSlash) {
            if (path == "/") {
                return { ciPath, found: true }
            }
            if (path.length + 1 == n.path.length &&
                n.path[path.length] == '/' &&
                path.toLocaleLowerCase() == n.path.slice(0, path.length).toLocaleLowerCase() &&
                n.handlers != null
            ) {
                return { ciPath: ciPath + n.path, found: true };
            }
        }

        return { ciPath, found };
    }
}


// export { Tree };