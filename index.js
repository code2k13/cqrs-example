const express = require('express');
const app = express();
const redis = require('redis')
const port = process.env.PORT | 8080;
const host = process.env.APP_HOST | '0.0.0.0';
const write_store_host = process.env.CQRS_REDIS_MASTER_SERVICE_HOST || "localhost"
const write_store_port = process.env.CQRS_REDIS_MASTER_SERVICE_PORT || 6379
const read_store_host = process.env.CQRS_REDIS_REPLICAS_SERVICE_HOST || "localhost"
const read_store_port = process.env.CQRS_REDIS_REPLICA_SERVICE_PORT || 6379
const redis_password = process.env.REDIS_PASSWORD || ""
const writeClient = redis.createClient({ "url": `redis://:${redis_password}@${write_store_host}:${write_store_port}` });
const readClient = redis.createClient({ "url": `redis://:${redis_password}@${read_store_host}:${read_store_port}` });

app.use(express.static('static'))
app.use(express.json());

app.post('/add', function (req, res) {
   writeClient.connect()
      .then(() => {
         let ts = + new Date()
         return writeClient.set(req.body.d_type + "_" + ts.toString(), req.body.data)
      })
      .then(() => res.json({ "success": true }))
      .catch(() => res.json({ "success": false }))
      .finally(() => {
         try { writeClient.quit() }
         catch (ex) {
            console.log("error closing writeClient");
            console.log(ex)
         }
      })
});

app.post('/search', function (req, res) {
   readClient.connect()
      .then(() => {
         return readClient.keys(req.body.sd_type + "*").then((d) => {
            let data = []
            let promises = []
            for (let ctr = 0; ctr < req.body.max_count; ctr++) {
               if (!d[ctr]) break
               promises.push(readClient.get(d[ctr]).then((v) => data.push(v)))
            }
            return Promise.all(promises).then(() => res.json(data))
         })
      })
      .catch(() => res.json(["server error"]))
      .finally(() => {
         try { readClient.quit() }
         catch (ex) {
            console.log("error closing readClient");
            console.log(ex)
         }
      })

});

app.listen(port, host);
console.log(`Running on http://${host}:${port}`);