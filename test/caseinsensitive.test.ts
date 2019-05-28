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
    route?: string,
    found?: boolean,
    slash?: boolean,
}

const tree = new Tree();

const fakeHandler = val => (ctx, next) => val;


describe('TestTreeFindCaseInsensitivePath', () => {


    let baseroutes = [
        "/hi",
        "/b/",
        "/ABC/",
        "/search/:query",
        "/cmd/:tool/",
        "/src/*filepath",
        "/x",
        "/x/y",
        "/y/",
        "/y/z",
        "/0/:id",
        "/0/:id/1",
        "/1/:id/",
        "/1/:id/2",
        "/aa",
        "/a/",
        "/doc",
        "/doc/go_faq.html",
        "/doc/go1.html",
        "/doc/go/away",
        "/no/a",
        "/no/b",
        "/Π",
        "/u/apfêl/",
        "/u/äpfêl/",
        "/u/öpfêl",
        "/v/Äpfêl/",
        "/v/Öpfêl",
        "/w/♬",  // 3 byte
        "/w/♭/", // 3 byte, last byte differs
        "/w/𠜎",  // 4 byte
        "/w/𠜏/", // 4 byte
    ]

    baseroutes.forEach(route => {
        tree.addRoute(route, [fakeHandler(route)])
    });

    baseroutes.forEach(route => {
        const { ciPath, found } = tree.findCaseInsensitivePath(route, true);
        it(`access ${route} findCaseInsensitive all works`, () => {
            assert(found, 'should be true')
        })
    })

    baseroutes.forEach(route => {
        const { ciPath, found } = tree.findCaseInsensitivePath(route, false);
        it(`access ${route} findCaseInsensitive all works`, () => {
            assert(found, 'should be true')
        })
    })

    const testRoutes: TestRoute[] = [
        { path: "/HI", route: "/hi", found: true, slash: false },
        { path: "/HI/", route: "/hi", found: true, slash: true },
        { path: "/B", route: "/b/", found: true, slash: true },
        { path: "/B/", route: "/b/", found: true, slash: false },
        { path: "/abc", route: "/ABC/", found: true, slash: true },
        { path: "/abc/", route: "/ABC/", found: true, slash: false },
        { path: "/aBc", route: "/ABC/", found: true, slash: true },
        { path: "/aBc/", route: "/ABC/", found: true, slash: false },
        { path: "/abC", route: "/ABC/", found: true, slash: true },
        { path: "/abC/", route: "/ABC/", found: true, slash: false },
        { path: "/SEARCH/QUERY", route: "/search/QUERY", found: true, slash: false },
        { path: "/SEARCH/QUERY/", route: "/search/QUERY", found: true, slash: true },
        { path: "/CMD/TOOL/", route: "/cmd/TOOL/", found: true, slash: false },
        { path: "/CMD/TOOL", route: "/cmd/TOOL/", found: true, slash: true },
        { path: "/SRC/FILE/PATH", route: "/src/FILE/PATH", found: true, slash: false },
        { path: "/x/Y", route: "/x/y", found: true, slash: false },
        { path: "/x/Y/", route: "/x/y", found: true, slash: true },
        { path: "/X/y", route: "/x/y", found: true, slash: false },
        { path: "/X/y/", route: "/x/y", found: true, slash: true },
        { path: "/X/Y", route: "/x/y", found: true, slash: false },
        { path: "/X/Y/", route: "/x/y", found: true, slash: true },
        { path: "/Y/", route: "/y/", found: true, slash: false },
        { path: "/Y", route: "/y/", found: true, slash: true },
        { path: "/Y/z", route: "/y/z", found: true, slash: false },
        { path: "/Y/z/", route: "/y/z", found: true, slash: true },
        { path: "/Y/Z", route: "/y/z", found: true, slash: false },
        { path: "/Y/Z/", route: "/y/z", found: true, slash: true },
        { path: "/y/Z", route: "/y/z", found: true, slash: false },
        { path: "/y/Z/", route: "/y/z", found: true, slash: true },
        { path: "/Aa", route: "/aa", found: true, slash: false },
        { path: "/Aa/", route: "/aa", found: true, slash: true },
        { path: "/AA", route: "/aa", found: true, slash: false },
        { path: "/AA/", route: "/aa", found: true, slash: true },
        { path: "/aA", route: "/aa", found: true, slash: false },
        { path: "/aA/", route: "/aa", found: true, slash: true },
        { path: "/A/", route: "/a/", found: true, slash: false },
        { path: "/A", route: "/a/", found: true, slash: true },
        { path: "/π", route: "/Π", found: true, slash: false },
        { path: "/π/", route: "/Π", found: true, slash: true },
        { path: "/u/ÄPFÊL/", route: "/u/äpfêl/", found: true, slash: false },
        { path: "/u/ÄPFÊL", route: "/u/äpfêl/", found: true, slash: true },
        { path: "/u/ÖPFÊL/", route: "/u/öpfêl", found: true, slash: true },
        { path: "/u/ÖPFÊL", route: "/u/öpfêl", found: true, slash: false },
        { path: "/v/äpfêL/", route: "/v/Äpfêl/", found: true, slash: false },
        { path: "/v/äpfêL", route: "/v/Äpfêl/", found: true, slash: true },
        { path: "/v/öpfêL/", route: "/v/Öpfêl", found: true, slash: true },
        { path: "/v/öpfêL", route: "/v/Öpfêl", found: true, slash: false },
        { path: "/w/♬/", route: "/w/♬", found: true, slash: true },
        { path: "/w/♭", route: "/w/♭/", found: true, slash: true },
        { path: "/w/𠜎/", route: "/w/𠜎", found: true, slash: true },
        { path: "/w/𠜏", route: "/w/𠜏/", found: true, slash: true },
    ]

    testRoutes.forEach(route => {
        const { ciPath, found } = tree.findCaseInsensitivePath(route.path, true);
        it(`access ${route.route} findCaseInsensitive all works`, () => {
            assert(found == route.found || (found && ciPath == route.route), 'should be true')
        })
    })

    testRoutes.forEach(route => {
        const { ciPath, found } = tree.findCaseInsensitivePath(route.path, false);
        it(`access ${route.route} findCaseInsensitive all works`, () => {
            if (route.slash) {
                assert(found == false, 'should be true')
            } else {
                assert(found == route.found || (found && ciPath == route.route), 'should be true')
            }
        })
    })
});