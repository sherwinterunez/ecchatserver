/*
*
* Author: Sherwin R. Terunez
* Contact: sherwinterunez@yahoo.com
*          sherwinterunez@gmail.com
*
* Date Created: November 24, 2019 9:19PM
*
* Description:
*
* FCM Test.
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
const _ = require("lodash");
const Utils = require('./js/utils.js');

const FCM_SERVER_KEY = "AAAASyg8sD4:APA91bE9Khrml8SZ_2bEdxCq2C2gR2oH0AcWtiodtyw5NXzuQikcfHcZWlF2XhS3x7ohvC_nBsdZpYLek8gkOnyTuWDYQ53wy1QcTFMLAo9SNkhExdcJmp7OAP3HsKtosLRniStK5SUB";

const FCM_DEFAULT_TOPIC = 'ECPREMIER';

const localRedis = redis.createClient({host:'127.0.0.1', port:'6379', password:'93ae615c8de441f51695301387beb87be091cc9c15ca6c613693da3c3bb9cd76'});

async function main() {

  var utils = new Utils(null, localRedis, null);

  var json = {
    id: await utils.genId(6),
    key: FCM_SERVER_KEY,
    topic: FCM_DEFAULT_TOPIC+'09474220659',
    title: 'Sample title '+moment().format('X'),
    body: 'Sample body '+moment().format('X'),
  }

  localRedis.lpush('fcmpushqueue', JSON.stringify(json), redis.print);

}

main();

// eof
