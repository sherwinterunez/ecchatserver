/*
*
* Author: Sherwin R. Terunez
* Contact: sherwinterunez@yahoo.com
*          sherwinterunez@gmail.com
*
* Date Created: October 11, 2019 9:26AM
*
* Description:
*
* Chat Server.
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
const myrequest = request;

const { Pool, Client } = require('pg');

const Database = require('./js/db.js');

const localRedis = redis.createClient({host:'127.0.0.1', port:'6379', password:'93ae615c8de441f51695301387beb87be091cc9c15ca6c613693da3c3bb9cd76'});

async function main() {

  var db = new Database(pool);

  var utils = new Utils(null, localRedis, db);

  var queued = await utils.getBuyLoadQueued();

  if(queued&&queued.length) {
    console.log(queued);

    for(var x in queued) {
      var pdata = queued[x];

      var data = {
        id: pdata.buyload_id,
        receiverno: pdata.buyload_receiverno,
        provider: pdata.buyload_provider,
        pcode: pdata.buyload_pcode,
        cgnid: pdata.buyload_cgnid,
        pdata: pdata,
      }

      localRedis.lpush('ecpcheckloadqueue', JSON.stringify(data), redis.print);
    }
  }


}

main();

// eof
