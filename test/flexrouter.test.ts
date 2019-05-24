/// <reference types="mocha" />

import * as assert from 'power-assert'
import * as path from 'path'
import * as util from 'util'

const debug = require('debug')('router')

import { Tree } from '../src/index'

const filename = path.basename(__filename)

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


const anyType: any = [];

const fakeHandler = val => (ctx, next) => val;

const checkPriorities = (n: Tree): number => {

  let prio = 0;

  n.children.forEach(tree => {
    prio += checkPriorities(tree);
  })

  if (n.handlers != null) {
    prio++;
  }

  if (n.priority != prio) {
    assert(false, `priority mismatch for node ${n.path}: is ${n.priority}, should be ${prio}`)
  }

  return prio;
}

const checkMaxParams = (n: Tree): number => {

  let maxParams = 0;

  n.children.forEach(tree => {
    let params = checkMaxParams(tree);
    if (params > maxParams) {
      maxParams = params;
    }
  })


  if (n.nType > NodeType.ROOT && !n.wildChild) {
    maxParams++;
  }

  if (n.maxParams != maxParams) {
    assert(false, `maxParams mismatch for node ${n.path}: is ${n.maxParams}, should be ${n.maxParams}`);
  }

  return maxParams;
}

const checkRequests = (tree: Tree, requests: Request[]) => {

  requests.forEach(request => {

    let { handlers, params } = tree.getValue(request.path);

    if (request.nilHandler == true) {

      it(`access ${request.path} not works`, () => {
        assert(handlers == null, 'should return null')

        if (request.wildcard) {
          assert.deepEqual(request.ps, params, 'should request.params deepEqual params')
        }

      })

    } else {


      it(`access ${request.path} works`, () => {

        assert(handlers[0].apply(this, anyType) == request.route, `should return ${request.path}`)

        if (request.wildcard) {


          assert.deepEqual(request.ps, params, 'should request.params deepEqual params')
        }

      })

    }

  })

}




describe('TestTreeAddAndGet', () => {

  const routes = [
    "/hi",
    "/contact",
    "/co",
    "/c",
    "/a",
    "/ab",
    // "/doc/",
    // "/doc/go_faq.html",
    // "/doc/go1.html",
    "/α",
    "/β",
  ]


  routes.forEach(route => {
    tree.addRoute(route, [fakeHandler(route)])
  });


  checkRequests(tree, [
    { path: "/a", nilHandler: false, route: "/a", },
    { path: "/", nilHandler: true, route: "", },
    { path: "/hi", nilHandler: false, route: "/hi", },
    { path: "/contact", nilHandler: false, route: "/contact", },
    { path: "/co", nilHandler: false, route: "/co", },
    { path: "/con", nilHandler: true, route: "", },
    { path: "/cona", nilHandler: true, route: "", },
    { path: "/no", nilHandler: true, route: "", },
    { path: "/ab", nilHandler: false, route: "/ab", },
    { path: "/no", nilHandler: true, route: "", },
    { path: "/α", nilHandler: false, route: "/α", },
    { path: "/β", nilHandler: false, route: "/β", },
  ])

  it('should checkPriorities right', () => {
    checkPriorities(tree)
  })

  it('should checkMaxParams right', () => {
    checkMaxParams(tree)
  })

});


describe('TestTreeWildcard', () => {

  const routes = [
    "/",
    "/cmd/:tool/:sub",
    "/cmd/:tool/",
    "/src/*filepath",
    "/search/",
    "/search/:query",
    "/user_:name",
    "/user_:name/about",
    "/files/:dir/*filepath",
    // "/doc/",
    // "/doc/go_faq.html",
    // "/doc/go1.html",
    "/info/:user/public",
    "/info/:user/project/:project",
  ]


  routes.forEach(route => {
    tree.addRoute(route, [fakeHandler(route)])
  });


  checkRequests(tree, [
    { path: "/cmd/test/", nilHandler: false, route: "/cmd/:tool/", ps: { tool: "test" }, wildcard: true },
    { path: "/cmd/test", nilHandler: true, route: "", ps: { tool: "test" } },
    { path: "/cmd/test/3", nilHandler: false, route: "/cmd/:tool/:sub", ps: { tool: 'test', "sub": 3 }, wildcard: true },
    { path: "/src/", nilHandler: false, route: "/src/*filepath", ps: { filepath: '/' }, wildcard: true },
    { path: "/src/some/file.png", nilHandler: false, route: "/src/*filepath", ps: { filepath: '/some/file.png' }, wildcard: true },
    { path: "/search/", nilHandler: false, route: "/search/", ps: {} },
    { path: "/search/someth!ng+in+ünìcodé", nilHandler: false, route: "/search/:query", ps: { query: "someth!ng+in+ünìcodé" }, wildcard: true },
    { path: "/search/someth!ng+in+ünìcodé/", nilHandler: true, route: "", ps: { query: "someth!ng+in+ünìcodé" }, wildcard: true },
    { path: "/user_gopher", nilHandler: false, route: "/user_:name", ps: { name: "gopher" }, wildcard: true },
    { path: "/user_gopher/about", nilHandler: false, route: "/user_:name/about", ps: { name: "gopher" }, wildcard: true },
    { path: "/files/js/inc/framework.js", nilHandler: false, route: "/files/:dir/*filepath", ps: { dir: "js", filepath: "/inc/framework.js" }, wildcard: true },
    { path: "/info/gordon/public", nilHandler: false, route: "/info/:user/public", ps: { user: "gordon" }, wildcard: true },
    { path: "/info/gordon/project/go", nilHandler: false, route: "/info/:user/project/:project", ps: { user: "gordon", project: "go" }, wildcard: true },
  ])

  it('should checkPriorities right', () => {
    checkPriorities(tree)
  })

  it('should checkMaxParams right', () => {
    checkMaxParams(tree)
  })


});


// describe('TestTreeWildcardConflict', () => {


//   const testRoutes = (tree: Tree, routes: TestRoute[]) => {

//     routes.forEach(route => {

//       try {

//         tree.addRoute(route.path, []);

//         it(`access ${route.path} does not conflict`, () => {

//           assert(route.conflict == false, `does not conflict`)

//         })

//       } catch (e) {

//         it(`access ${route.path} should be conflict`, () => {

//           assert(route.conflict, `should be conflict`)

//         })

//       }

//     })

//   }


//   const routes = [
//     { path: "/cmd/:tool/:sub", conflict: true },
//     { path: "/cmd/vet", conflict: true },
//     { path: "/src/*filepath", conflict: true },
//     { path: "/src/*filepathx", conflict: true },
//     { path: "/src/", conflict: true },
//     { path: "/src1/", conflict: false },
//     { path: "/src1/*filepath", conflict: true },
//     { path: "/src2*filepath", conflict: true },
//     { path: "/search/:query", conflict: true },
//     { path: "/search/invalid", conflict: true },
//     { path: "/user_:name", conflict: true },
//     { path: "/user_x", conflict: true },
//     { path: "/id:id", conflict: false },
//     { path: "/id/:id", conflict: true },
//   ]

//    testRoutes(tree, routes);

// });




debug(util.inspect(tree, { showHidden: false, depth: null }))
