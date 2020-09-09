/*
*
* Author: Sherwin R. Terunez
* Contact: sherwinterunez@yahoo.com
*          sherwinterunez@gmail.com
*
* Date Created: November 24, 2019 12:05AM
*
* Description:
*
* FCM Server.
*

npm install nconf --save
npm install moment --save
npm install websocket --save
npm install sha1 --save
npm install body-parser --save
npm install express --save
npm install node-phpfpm --save
npm install winston --save
npm install node-jsencrypt --save
npm install crypto-js --save
npm install redis --save
npm install connect-redis express-session --save
npm install inquirer --save
npm install pg --save
npm install serialport-gsm --save
npm install request --save
npm install https://github.com/sherwinterunez/serialport-gsm
*/

const fs = require('fs');
const path = require('path');
const uuid4 = require('uuid4');
const base64 = require('base-64');
const moment = require('moment');
const redis = require('redis');
const WebSocketServer = require('websocket').server;
const Worker = require("jest-worker").default;
const https = require('https');
const _ = require("lodash");
const Utils = require('./js/utils.js');

const worker = new Worker(require.resolve('./js/fcmworker'));

//const DEFAULT_PATH = path.dirname(process.argv[1]);

const DEFAULT_PATH = process.cwd();

var privateKey = fs.readFileSync('/etc/letsencrypt/live/ecpwallet.com/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/ecpwallet.com/fullchain.pem', 'utf8');
var chain = fs.readFileSync('/etc/letsencrypt/live/ecpwallet.com/chain.pem')

var credentials = { key: privateKey, cert: certificate, ca: chain };

const sockServer = https.createServer(credentials);

var config = {
  fcmServer: {
    websocket: 8290,
  }
}

const localRedis = redis.createClient({host:'127.0.0.1', port:'6379', password:'93ae615c8de441f51695301387beb87be091cc9c15ca6c613693da3c3bb9cd76'});

async function main() {

  sockServer.listen(config.fcmServer.websocket, () => {
    console.log(`WebSocketServer is listening on port ${config.fcmServer.websocket}.`);
  });

  wsServer = new WebSocketServer({
    httpServer: sockServer
  });

  wsServer.on('request', function(request) {
    var utils = new Utils();

    var myConId = utils.uuid4();

    console.log((new Date()) + ' Connection from origin ['
          + request.origin + ']');

    if(request.origin=='https://modemserver.local') {

      var connection = request.accept(null, request.origin);

      modemserver[myConId] = connection;

      connection.sendUTF(JSON.stringify({ type: 'modeminit', timestamp: utils.unixStamp()} ));

      function modemLoop() {

        localRedis.rpop("outbox", (err, data) => {
          if(data==null) {
          } else {
            localRedis.lpush('modemsentqueue', data, redis.print);
            connection.sendUTF(data);
          }
        });

        setTimeout(function(){
          if(modemserver[myConId]) {
            modemLoop();
          } else {
            console.log('Modem has been disconnected.');
          }
        }, 100);
      }

      modemLoop();
    } else {
      request.reject();
    }

    connection.on('message', async function(message) {
      var self = this;

      if (message.type === 'utf8') {
        message.remoteAddresss = connection.remoteAddress;

        try {

          var utils = new Utils();

          var json = JSON.parse(message.utf8Data);

          if(json.type == 'ping') {
            self.sendUTF(JSON.stringify({ type: 'pong', msgid:json.msgid}));
            return;
          }

        } catch(e) {
          console.log(e);
        }
      }
    });

    connection.on('close', function(connection) {
      var self = this;

      console.log('Connection closed.');

      delete modemserver[myConId];

    });

  });

  async function pushNotiLoop() {
    var utils = new Utils(null, localRedis, null);

    var ret = await new Promise((resolve, reject) => {
      localRedis.rpop("fcmpushqueue", async (err, data) => {
        if(err) {
          resolve(false);
        } else {
          if(data) {
            try {
              var pdata = JSON.parse(data);

              if(pdata&&pdata.id&&pdata.key&&pdata.topic&&pdata.title&&pdata.body) {

                //console.log(pdata);

                worker.send(pdata).then(async (wret)=>{

                  console.log(wret);

                  if(wret&&wret.body&&wret.body.message_id) {
                    console.log(wret.body);

                    pdata.msgid = pdata.id;
                    pdata.id = await utils.genId(6);
                    pdata.message_id = wret.body.message_id;

                    localRedis.zadd('zfcmpushdone', 'NX', pdata.id, JSON.stringify(pdata), redis.print);

                    resolve(wret);
                  } else {
                    var failed;
                    if(pdata.failed&&parseInt(pdata.failed)>0) {
                      failed = parseInt(pdata.failed) + 1;
                    } else {
                      failed = 1;
                    }
                    pdata.failed = failed;

                    localRedis.lpush('fcmpushqueue', JSON.stringify(pdata), redis.print);

                    resolve(false);
                  }
                });
              } else {
                resolve(false);
              }
            } catch(e) {
              console.log(e);
              resolve(false);
            }
          } else {
            resolve(false);
          }
        }
      });
    });

    if(ret) {
      console.log(ret);
    }

    setTimeout(function(){
      pushNotiLoop();
    }, 100);
  }

  pushNotiLoop();
}

main();

// eof
