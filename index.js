const serverless = require("serverless-http");
const Koa = require("koa");
const route = require("koa-route");
const compress = require("koa-compress");
const { bodyParser } = require("@koa/bodyparser");

const app = (module.exports = new Koa());
app.use(compress());
app.use(bodyParser({
  enableTypes: ['json', 'text']
}));

const API_CONFIG = {
  baseURL: process.env.EXPRESS_OTEL_API_ENDPOINT
};

app.use(
  route.get("/", async function (ctx) {
    ctx.body = "Hello World";
  })
);

app.use(
  route.get("/path", async function (ctx) {
    ctx.body = "Hello from path";
  })
);

app.use(
  route.post("/", async function (ctx) {
    ctx.body = ctx.request.body || "Hello from POST";
  })
);

app.use(
  route.get("/weather", async function (ctx, next) {
    var axios = require("axios");

    var config = {
      method: "get",
      url: `${API_CONFIG.baseURL}/weather?location=${ctx.request.query.location}`,
      headers: {
        "Content-Type": "application/json",
      },
    };

    console.log(`config: ${JSON.stringify(config)}`);
    // var config = {
    //   method: "get",
    //   url: `${API_CONFIG.baseURL}/weather?q=${ctx.request.query.location}&appid=${API_CONFIG.TOKEN}`,
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    // };

    return await axios(config)
      .then(function (response) {
        console.info(
          `${ctx.request.method} ${ctx.request.originalUrl}- ${JSON.stringify(
            ctx.request.query.location
          )} - Request Successful!!`
        );
        ctx.body = response.data;
        next();
      })
      .catch(function (error) {
        console.error(
          `${ctx.request.method} ${ctx.request.originalUrl}- ${JSON.stringify(
            ctx.request.query.location
          )} - Error fetching data`
        );
        ctx.throw(404,`Error retrieving data, ${ctx.request.query?.location} ${error.message}`)
      });
  })
);


if (!module.parent) app.listen(3000);

module.exports.handler = serverless(app);
