/// <reference types="mocha" />

import * as assert from 'power-assert'
import * as request from 'supertest';
import * as http from 'http';

import Router from '../src';

import * as Koa from "koa";

describe('Router', () => {

    it('create new router ', () => {
        const router = new Router();
        assert(router instanceof Router, 'router should instanceof router')
    })

    it('shares context between routers (gh-205)', () => {
        const app = new Koa();
        const router = new Router({
            middlewares: [
                async (ctx, next) => {
                    ctx.foo = "foo"
                    return next();
                }
            ]
        });

        router.get('/', function (ctx, next) {
            ctx.body = { foo: ctx.foo };
        });

        app.use(router.routes());

        request(http.createServer(app.callback()))
            .get('/')
            .expect(200)
            .end((err, res) => {
                assert.deepEqual(res.body, { foo: 'foo' });
            });
    });

    it('sub router use user path', () => {
        const app = new Koa();
        const router = new Router();

        const router1 = router.group({
            path: '/user'
        });

        router1.post(':id', async (ctx, next) => {
            ctx.body = ctx.params;
        })

        app.use(router.routes());

        request(http.createServer(app.callback()))
            .post('/user/12')
            .expect(200)
            .end((err, res) => {
                assert.deepEqual(res.body, { id: 12 });
            });
    });


    it('sub router use user path and middleware', () => {
        const app = new Koa();
        const router = new Router();

        const router1 = router.group({
            path: '/user',
            middlewares: [
                async (ctx, next) => {
                    ctx.foo = "foo"
                    return next();
                }
            ]
        });

        router1.post(':id', async (ctx, next) => {
            ctx.body = { ...ctx.params, foo: ctx.foo }
        })

        app.use(router.routes());

        request(http.createServer(app.callback()))
            .post('/user/12')
            .expect(200)
            .end((err, res) => {
                assert.deepEqual(res.body, { id: 12, foo: 'foo' });
            });
    });

    it('redirectTrailingSlash enabled match ', (done) => {
        const app = new Koa();
        const router = new Router();


        router.post('/user/', async (ctx, next) => {
            ctx.body = "foo";
        })

        app.use(router.routes());

        // redirect
        request(http.createServer(app.callback()))
            .post('/user')
            .expect(307)
            .expect('Location', '/user/')
            .end(done);
    });

    it('redirectTrailingSlash enabled', (done) => {
        const app = new Koa();
        const router = new Router();


        router.post('/user', async (ctx, next) => {
            ctx.body = "foo";
        })

        app.use(router.routes());

        // redirect
        request(http.createServer(app.callback()))
            .post('/user/')
            .expect(307)
            .expect('Location', '/user')
            .end(done);
    });

    it('redirectTrailingSlash disabled', (done) => {
        const app = new Koa();
        const router = new Router({redirectTrailingSlash:false});


        router.post('/user', async (ctx, next) => {
            ctx.body = "foo";
        })

        app.use(router.routes());

        // redirect
        request(http.createServer(app.callback()))
            .post('/user/')
            .expect(404)
            .end(done);
    });

    it('redirectTrailingSlash disabled1', (done) => {
        const app = new Koa();
        const router = new Router({redirectTrailingSlash:false});


        router.post('/user/', async (ctx, next) => {
            ctx.body = "foo";
        })

        app.use(router.routes());

        // redirect
        request(http.createServer(app.callback()))
            .post('/user')
            .expect(404)
            .end(done);
    });
})