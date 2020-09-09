/*
*
* Author: Sherwin R. Terunez
* Contact: sherwinterunez@yahoo.com
*          sherwinterunez@gmail.com
*
* Date Created: October 22, 2019 10:29PM
*
* Description:
*
* Modem Server.
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
npm install redis connect-redis express-session --save
npm install inquirer --save
npm install pg --save
npm install serialport-gsm --save
npm install request --save
*/

const fs = require('fs');
const path = require('path');
const nconf = require('nconf');
const express = require('express')
const bodyParser = require('body-parser');
const WebSocketServer = require('websocket').server;
const http = require('http');
const https = require('https');
const sha1 = require('sha1');
const moment = require('moment');
const redis = require('redis');
const uuid4 = require('uuid4');
const request = require('request');
const Utils = require('./js/utils.js');

// read ssl certificate
var privateKey = fs.readFileSync('/etc/letsencrypt/live/ecpwallet.com/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/ecpwallet.com/fullchain.pem', 'utf8');
var chain = fs.readFileSync('/etc/letsencrypt/live/ecpwallet.com/chain.pem')

var credentials = { key: privateKey, cert: certificate, ca: chain };

var modemserver = [];

const modemServer = express();

const appRouter = express.Router();

const sockServer = https.createServer(credentials);

const appServer = https.createServer(credentials, modemServer);

var config = {
  modemServer: {
    port: 8180,
    websocket: 8190,
  }
}

const localRedis = redis.createClient({host:'127.0.0.1', port:'6379', password:'93ae615c8de441f51695301387beb87be091cc9c15ca6c613693da3c3bb9cd76'});

modemServer.use(bodyParser.json())

modemServer.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

modemServer.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin', ['*']);
    res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.append('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

async function main() {

  appRouter.get('/', (request, response) => {
    response.json({ info: 'ModemServer is running.' })
  })

  appRouter.get('/send\.api', async function(request, response){
    //console.log(request);
    //console.log(request.query);

    if(request.query&&request.query.mobile&&request.query.message) {

      var utils = new Utils(null, localRedis);

      var id = await utils.genId();

      var json = {
        id: id,
        mobile: request.query.mobile,
        message: request.query.message,
        timestamp: moment().format('x'),
      };

      localRedis.lpush('outbox', JSON.stringify(json), redis.print);
    }

    response.json({ info: 'message queued.' });
  });

  modemServer.use('/', appRouter);

  appServer.listen(config.modemServer.port, () => {
    console.log(`ModemServer listening on port ${config.modemServer.port}.`)
  })

  sockServer.listen(config.modemServer.websocket, () => {
    console.log(`WebSocketServer is listening on port ${config.modemServer.websocket}.`);
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

}

main();

// eof
