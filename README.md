# koa-flexrouter

flexrouter implement in koa

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![coverage][coverage-image]][coverage-url]

[npm-image]: https://img.shields.io/npm/v/koa-flexrouter.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa-flexrouter
[travis-image]: https://travis-ci.org/yviscool/koa-flexrouter.svg?branch=master
[travis-url]: https://travis-ci.org/yviscool/koa-flexrouter
[coverage-url]: https://coveralls.io/github/yviscool/koa-flexrouter
[coverage-image]: https://coveralls.io/repos/github/yviscool/koa-flexrouter/badge.svg

## Performance
Compared to koa-router, find-my-way, it has a similar performance result when there're 50 routes. When increase route to 2401, the performance result:

```bash
codespace ➜ /workspaces/koa-flexrouter/benchmark (master ✗) $ node index.js 
benchmark home path: '/', and a random path: '/cndhomeainrmsfbn/1/wxcfkdikzb'
koa-router#topic-detail x 944 ops/sec ±122.08% (93 runs sampled)
flexrouter#topic-detail x 2,887,212 ops/sec ±1.10% (93 runs sampled)
find-my-way#topic-detail x 1,079,235 ops/sec ±6.18% (87 runs sampled)

codespace ➜ /workspaces/koa-flexrouter/benchmark (master ✗) $ node index.js 
benchmark home path: '/', and a random path: '/nblqjipdz/1/'
koa-router#topic-detail x 959 ops/sec ±121.41% (94 runs sampled)
flexrouter#topic-detail x 4,112,523 ops/sec ±1.21% (89 runs sampled)
find-my-way#topic-detail x 1,847,886 ops/sec ±1.22% (96 runs sampled)

codespace ➜ /workspaces/koa-flexrouter/benchmark (master ✗) $ node index.js 
benchmark home path: '/', and a random path: '/xeyk/1/avdegacnmiesgk'
koa-router#topic-detail x 977 ops/sec ±119.90% (92 runs sampled)
flexrouter#topic-detail x 2,550,022 ops/sec ±0.92% (93 runs sampled)
find-my-way#topic-detail x 1,343,876 ops/sec ±0.66% (94 runs sampled)
```

## Installation

```sh
npm i koa-flexrouter
```

## Usage

```js
import Router from 'koa-flexrouter';
import * as Koa from 'koa';

const router = new Router();
const app = new Koa();

router.get('/test', async (ctx, next) => {

})

router.post('/test', async (ctx, next) => {

})

app.use(router.routes())
```

### sub-router

```js
import Router from 'koa-flexrouter';
import * as Koa from 'koa';

const router = new Router();
const app = new Koa();

var subRouter = router.group({
    path: '/sub',
    middlewares: [
        async (ctx, next) => {
                return next();
        },
        async (ctx, next) => {
            return next();
        },
    ]
})

subRouter.get('/:id/xxx', async (ctx, next) => {

})

subRouter.post('/:id/*action', async (ctx, next) => {

})

app.use(router.routes())
```

