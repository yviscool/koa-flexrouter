# koa-flexrouter

flexrouter implement in koa

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![coverage][coverage-image]][coverage-url]

[npm-image]: https://img.shields.io/npm/v/koa-flexrouter.svg?style=flat-square
[npm-url]: https://npmjs.org/package/koa-flexrouter
[travis-image]: https://travis-ci.org/yviscool/koa-flexrouter.svg?branch=master
[travis-url]: https://travis-ci.org/yviscool/koa-flexrouter
[coverage-url]: https://codecov.io/gh/yviscool/koa-flexrouter
[coverage-image]: https://codecov.io/gh/yviscool/koa-flexrouter/branch/master/graph/badge.svg

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

