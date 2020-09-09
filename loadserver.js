/*
*
* Author: Sherwin R. Terunez
* Contact: sherwinterunez@yahoo.com
*          sherwinterunez@gmail.com
*
* Date Created: December 2, 2019 7:49PM
*
* Description:
*
* Buy Load Server.
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

const { Pool, Client } = require('pg');

const Database = require('./js/db.js');

const worker = new Worker(require.resolve('./js/loadworker'));

const DEFAULT_PATH = path.dirname(process.argv[1]);

var credentials = { key: privateKey, cert: certificate, ca: chain };

const sockServer = https.createServer(credentials);

var config = {
  loadServer: {
    websocket: 8291,
  }
}

const localRedis = redis.createClient({host:'127.0.0.1', port:'6379', password:'93ae615c8de441f51695301387beb87be091cc9c15ca6c613693da3c3bb9cd76'});

var lastdatastamp = 0;

async function main() {

  async function buyLoadLoop() {

    var db = new Database(pool);

    var utils = new Utils(null, localRedis, db);

    if(lastdatastamp<1) {
      lastdatastamp = parseFloat(utils.Moment().format('X'));

      var queued = await utils.getBuyLoadNew();

      if(queued&&queued.length) {
        console.log(queued);

        for(var x in queued) {
          var qdata = queued[x];

          localRedis.lpush('ecpbuyloadqueue', JSON.stringify(qdata), redis.print);
        }
      }
    }

    var status = await new Promise((resolve, reject) => {

      localRedis.rpop("ecpbuyloadqueue", async (err, data) => {
        if(err) {
          console.log(err);
          resove(false);
        } else {
          if(data) {
            try {
              var pdata = JSON.parse(data);

              //console.log(pdata);

              if(pdata&&pdata.buyload_id&&pdata.buyload_status&&pdata.buyload_status=='NEW') {

                var content = [];
                content['buyload_status'] = 'SENT';
                content['buyload_updatestamp'] = 'now()';

                console.log({content: content});

                var res = await db.Update('tbl_buyload', content, "buyload_id="+pdata.buyload_id, (client, result) => {
                  client.release();
                  //console.log(result);
                }, (error) => {
                  console.log('ERROR!');
                  console.log(error);
                });

                if(!res) {
                  localRedis.lpush('ecpbuyloadqueue', data, redis.print);
                  resolve(false);
                  return;
                }
              }

              if(pdata&&pdata.buyload_id&&pdata.buyload_receiverno&&pdata.buyload_provider&&pdata.buyload_pcode) {

                var data = {
                  id: pdata.buyload_id,
                  receiverno: pdata.buyload_receiverno,
                  provider: pdata.buyload_provider,
                  pcode: pdata.buyload_pcode,
                  cgnid: 'ECP'+pdata.buyload_id,
                  pdata: pdata,
                }

                console.log({data: data});

                worker.send(data).then(async (wret)=>{

                  lastdatastamp = parseFloat(utils.Moment().format('X'));

                  try {

                    if(wret&&wret.retdata&&wret.pdata) {
                      console.log({retdata: wret.retdata});
                      console.log({pdata: wret.pdata});
                      console.log({data: data});

                      if(wret.retdata.error_code) {

                        var error_code = wret.retdata.error_code;
                        var error_message = wret.retdata.error_message;

                        error_message = error_message.replace("'","''");

                        if(error_code=='0x4040') {

                        } else
                        if(error_code=='0x4041') {

                        } else
                        if(error_code=='0x4042') {

                        } else
                        if(error_code=='0x4043') {

                        }

                        var content = [];
                        content['buyload_status'] = 'REVERSED';
                        content['buyload_errorcode'] = error_code;
                        content['buyload_errormessage'] = error_message;
                        content['buyload_updatestamp'] = 'now()';

                        console.log({content: content});

                        var res = await db.Update('tbl_buyload', content, "buyload_id="+wret.pdata.buyload_id, (client, result) => {
                          client.release();
                          //console.log(result);
                        }, (error) => {
                          console.log('ERROR!');
                          console.log(error);
                        });

                        if(!res) {
                          resolve(false);
                          return;
                        }

                        var refundInfo = await utils.refundLoad(wret.pdata, db);

                        console.log({refundInfo: refundInfo});

                        var loadProduct = await utils.getEloadProduct(wret.pdata.buyload_pcode, wret.pdata.buyload_provider);

                        var curdate = utils.Moment().format("MMM D YYYY h:mma");

                        var msg = "Your load request "+loadProduct.eloadproduct_name+" for "+wret.pdata.buyload_receiverno+" has failed and been refunded to you. "+curdate+" Bal:P"+refundInfo.user_balance+" Tx:"+refundInfo.trans_id;

                        //var fcm = {
                        //  key: FCM_SERVER_KEY,
                          //topic: '/topics/'+FCM_DEFAULT_TOPIC+json.touserlogin,
                        //  topic: FCM_DEFAULT_TOPIC+wret.pdata.buyload_userlogin,
                        //  title: 'ecpMessenger',
                        //  body: msg,
                        //}

                        //console.log(fcm);

                        //utils.sendFCM(fcm);

                        //msg = msg.replace('AutoloadMAX','');
                        //msg = msg.replace('Airtime','');

                        var json = {
                          id: await utils.genId(),
                          mobile: wret.pdata.buyload_userlogin,
                          message: msg,
                          senderid: 'ecpMessenger',
                          timestamp: moment().format('x'),
                        };

                        //localRedis.lpush('outbox', JSON.stringify(json), redis.print);

                        localRedis.lpush('ecpinfobox', JSON.stringify(json), redis.print);

                        if(wret.pdata.buyload_connectionid) {

                          var json = {
                            type: 'points',
                            userid: wret.pdata.buyload_userid,
                            conid: wret.pdata.buyload_connectionid,
                            balance: refundInfo.user_balance,
                            timestamp: utils.unixStamp()
                          }

                          localRedis.lpush('ecpupdatebalance', JSON.stringify(json), redis.print);
                        }

                        resolve(true);
                        return;

                      } else {

                        var content = [];
                        content['buyload_status'] = 'QUEUED';
                        content['buyload_updatestamp'] = 'now()';

                        console.log({content: content});

                        var res = await db.Update('tbl_buyload', content, "buyload_id="+data.id, (client, result) => {
                          client.release();
                          //console.log(result);
                        }, (error) => {
                          console.log('ERROR!');
                          console.log(error);
                        });

                        if(res) {
                          data.timestamp = parseFloat(utils.Moment().format('X'));
                          data.checkctr = 1;

                          localRedis.lpush('ecpcheckloadqueue', JSON.stringify(data), redis.print);

                          resolve(true);
                          return;
                        } else {
                          resolve(false);
                          return;
                        }

                      }

                    } else {
                      resolve(false);
                      return;
                    }

                  } catch(e) {
                    console.log(e);
                    resolve(false);
                    return;
                  }
                });

              }
            } catch(e) {
              console.log(e);
              resolve(false);
            }
          } else {
            //console.log('BUYLOADSERVER: no data to process.');
            resolve(true);
          }
        }
      });

    });

    var now = parseFloat(utils.Moment().format('X'));

    var elapsed = now - lastdatastamp;

    //if(!status) {
      //console.log('BUYLOADSERVERSTATUS: Returned false.');
    //}

    if(elapsed>300) {
      console.log('BUYLOADSERVERELAPSED: '+elapsed);
      process.exit(0);
    } else {

      var timeOut = parseInt(_.random(100, 500));

      setTimeout(function(){
        buyLoadLoop();
      }, timeOut);

    }

  }

  async function checkLoop() {

    var db = new Database(pool);

    var utils = new Utils(null, localRedis, db);

    var now = parseFloat(utils.Moment().format('X'));

    var elapsed = now - lastdatastamp;

    if(elapsed>360) {
      console.log('BUYLOADSERVERCHECKLOOP: '+elapsed);
      process.exit(0);
    } else {

      var timeOut = parseInt(_.random(5000,10000));

      setTimeout(function(){
        console.log('BUYLOADSERVERCHECKLOOP: working... '+elapsed);
        checkLoop();
      }, timeOut);

    }

  }

  buyLoadLoop();
  checkLoop();
}

main();

// eof
