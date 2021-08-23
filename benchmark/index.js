var Benchmark = require('benchmark');
var suite = new Benchmark.Suite;

const s = 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const buildRandomRoute = () => {
    const len = Math.floor(Math.random() * 20);
    return Array.from(new Array(len)).reduce(memo => memo += s[Math.floor(Math.random() * 26)], '');
}

let routes = [];

routes.push('/');

for (let i = 0; i < 200; i++) {
    const path = buildRandomRoute();
    if (path != '') {

        routes.push('/' + path);
        routes.push('/' + path + '/:id');
        for (let i = 0; i < 10; i++) {
            routes.push('/' + path + '/:id/' + buildRandomRoute());
        }
    }
}

// filter 
routes = [...new Set(routes)];

const koaRouter = new require('koa-router')();
const myWayRouter = require('find-my-way')()
const flexRouter = new (require('koa-flexrouter').default)();

routes.forEach(r => koaRouter.get(r, async (ctx) => { ctx.body = "zjl" }));
routes.forEach(r => flexRouter.get(r, async (ctx) => { ctx.body = "zjl" }));
routes.forEach(r => myWayRouter.on('GET', r, async (ctx) => { ctx.body = "zjl" }));


// pick a random path to benchmark
const i = Math.floor(Math.random() * routes.length);
const path = routes[i].replace(':id', '1');

console.log(`benchmark home path: '/', and a random path: '${path}'`)

const trees  = flexRouter.trees.get('GET');


suite
    .add('koa-router#topic-detail', () => {
        koaRouter.match(path, 'GET');
    })
    .add('flexrouter#topic-detail', () => {
        trees.getValue(path);
    })
    .add('find-my-way#topic-detail', () => {
        // myWayRouter.find('GET', path)
        myWayRouter.lookup({
            url: path,
            method: 'GET'
        }, {})
    })
    .on('cycle', (event) => {
        console.log(String(event.target))
    })
    .on('complete', () => { })
    .run({ async: true })