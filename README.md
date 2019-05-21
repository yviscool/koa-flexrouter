# koa-flexrouter
flexrouter implement in koa


## Installation

Install using [npm](https://www.npmjs.org/):

```sh
npm install koa-flexrouter
```

## Usage

```js
import Router from 'koa-flexrouter';
import * as Koa from 'koa';

const router = new Router();
const app = new Koa();


router.get('/test', async(ctx, next) => {

})

router.post('/test', async(ctx, next) => {

})

app.use(router.routes())



```



### sub-router

```js
import Router from 'koa-flexrouter';
import * as Koa from 'koa';

const router = new Router();
const app = new Koa();

var subRouter = router.group(
    {
        path:'/sub',
        middlewares:[ 
            async (ctx, next) => { return next(); }, 
            async (ctx, next) => { return next();}, 
        ]
    }
)

subRouter.get('/:id/xxx', async (ctx, next) => {

})

subRouter.post('/:id/*action', async (ctx, next) => {
    
})


app.use(router.routes())



```


