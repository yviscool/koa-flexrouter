/// <reference types="mocha" />

import * as assert from 'power-assert'

import { Tree } from '../src/lib/tree'

enum NodeType { DEFAULT, ROOT, PARAM, CATCHALL }

interface Request {
    path?: string,
    nilHandler?: boolean,
    route?: string,
    ps?: any
    wildcard?: boolean
}

interface TestRoute {
    path?: string;
    conflict?: boolean;
}

const tree = new Tree();

const fakeHandler = val => (ctx, next) => val;


describe('TestTreeWildcardConflict', () => {


    let baseroutes = [
        "/hi",
        "/contact",
        "/co",
        "/c",
        "/a",
        "/ab",
        "/α",
        "/β",
        "/",
        "/cmd/:tool/:sub",
        "/cmd/:tool/",
        "/src/*filepath",
        "/search/",
        "/search/:query",
        "/user_:name",
        "/user_:name/about",
        "/files/:dir/*filepath",
        "/info/:user/public",
        "/info/:user/project/:project",
    ]

    baseroutes.forEach(route => {
        tree.addRoute(route, [fakeHandler(route)])
    });

    const testRoutes = (tree: Tree, routes: TestRoute[]) => {

        routes.forEach(route => {

            try {

                tree.addRoute(route.path, []);

                it(`access ${route.path} does not conflict`, () => {

                    assert(route.conflict == false, `does not conflict`)

                })

            } catch (e) {

                it(`access ${route.path} should be conflict`, () => {

                    assert(route.conflict, `should be conflict`)

                })

            }

        })

    }

    const routes = [
        { path: "/cmd/:tool/:sub", conflict: true },
        { path: "/cmd/vet", conflict: true },
        { path: "/src/*filepath", conflict: true },
        { path: "/src/*filepathx", conflict: true },
        { path: "/src/", conflict: true },
        { path: "/src1/", conflict: false },
        { path: "/src1/*filepath", conflict: true },
        { path: "/src2*filepath", conflict: true },
        { path: "/search/:query", conflict: true },
        { path: "/search/invalid", conflict: true },
        { path: "/user_:name", conflict: true },
        { path: "/user_x", conflict: true },
        { path: "/id:id*", conflict: true},
        { path: "/ixl/:/zjl", conflict: true},
        { path: "/*action/iiii", conflict: true},
        { path: "/action/*role/zjl", conflict: true},
    ]

    testRoutes(tree, routes);

});