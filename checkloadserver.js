/*
*
* Author: Sherwin R. Terunez
* Contact: sherwinterunez@yahoo.com
*          sherwinterunez@gmail.com
*
* Date Created: January 28, 2020 9:20AM
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
const numeral = require('numeral');
const Utils = require('./js/utils.js');

const { Pool, Client } = require('pg');

const Database = require('./js/db.js');

const worker = new Worker(require.resolve('./js/checkloadworker'));

const DEFAULT_PATH = process.cwd();

var credentials = { key: privateKey, cert: certificate, ca: chain };

const sockServer = https.createServer(credentials);

var config = {
  loadServer: {
    websocket: 8291,
  }
}

const localRedis = redis.createClient({host:'127.0.0.1', port:'6379', password:'93ae615c8de441f51695301387beb87be034234fsfdca6c613693da3c3bb9cd76'});

var lastdatastamp = 0;

async function main() {

  async function checkLoadLoop() {

    var db = new Database(pool);

    var utils = new Utils(null, localRedis, db);

    if(lastdatastamp<1) {
      lastdatastamp = parseFloat(utils.Moment().format('X'));

      var queued = await utils.getBuyLoadQueued();

      if(queued&&queued.length) {
        console.log(queued);

        for(var x in queued) {
          var qdata = queued[x];

          var tdata = {
            id: qdata.buyload_id,
            receiverno: qdata.buyload_receiverno,
            provider: qdata.buyload_provider,
            pcode: qdata.buyload_pcode,
            cgnid: qdata.buyload_cgnid,
            pdata: qdata,
          }

          localRedis.lpush('ecpcheckloadqueue', JSON.stringify(tdata), redis.print);
        }
      }
    }

    var status = await new Promise((resolve, reject) => {

      localRedis.rpop("ecpcheckloadqueue", async (err, data) => {
        if(err) {
          console.log(err);
          resolve(false);
        } else {
          if(data) {
            try {

              //console.log(data);

              var pdata = JSON.parse(data);

              if(pdata&&pdata.id&&pdata.timestamp) {

                if(parseInt(pdata.checkctr)==1) {
                  var content = [];
                  content['buyload_status'] = 'CHECKING';
                  content['buyload_updatestamp'] = 'now()';

                  console.log({ecpcheckloadqueue:pdata});

                  //console.log({content: content});

                  var res = await db.Update('tbl_buyload', content, "buyload_id="+pdata.id, (client, result) => {
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
                }

                var curstamp = parseFloat(utils.Moment().format('X'));

                var timestamp = parseFloat(pdata.timestamp);

                var elapsed = curstamp - timestamp;

                //console.log({elapsed: elapsed});

                var maxtime = 10;

                if(pdata.pending) {
                  maxtime = 300;
                }

                if(elapsed<maxtime) {
                  //pdata.timestamp = parseFloat(utils.Moment().format('X'));
                  pdata.checkctr = parseInt(pdata.checkctr) + 1;

                  localRedis.lpush('ecpcheckloadqueue', JSON.stringify(pdata));

                  resolve(false);
                  return;
                }
              }

              if(pdata&&pdata.id&&pdata.receiverno&&pdata.provider&&pdata.pcode) {

                console.log({ecpcheckloadqueue:pdata});

                pdata.method = 'checkload';

                worker.send(pdata).then(async (wret)=>{

                  lastdatastamp = parseFloat(utils.Moment().format('X'));

                  try {

                    if(wret&&wret.retdata&&wret.pdata) {
                      console.log({retdata: wret.retdata});
                      console.log({pdata: wret.pdata});
                      console.log({data: data});

                      var retdata = wret.retdata;

                      if(retdata.error_code) {

                        if(retdata.error_code=='0x4000') {

                          var content = [];
                          content['buyload_status'] = 'REVERSED';
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

                          try {
                            var ubal = numeral(refundInfo.user_balance).format('0.00')
                          } catch(e) {
                            var ubal = refundInfo.user_balance;
                            console.log(e);
                          }

                          var msg = "Your load request "+loadProduct.eloadproduct_name+" for "+wret.pdata.buyload_receiverno+" has failed and been refunded to you. "+curdate+" Bal:P"+ubal+" Tx:"+refundInfo.trans_id;

                          var json = {
                            id: await utils.genId(),
                            mobile: wret.pdata.buyload_userlogin,
                            message: msg,
                            senderid: 'ecpMessenger',
                            timestamp: moment().format('x'),
                          };

                          //localRedis.lpush('outbox', JSON.stringify(json), redis.print);

                          localRedis.lpush('ecpinfobox', JSON.stringify(json), redis.print);

                          resolve(true);
                          return;

                        } else {
                          resolve(false);
                          return;
                        }
                      } else
                      if(retdata.buyload_id&&(retdata.buyload_status=='SUCCESS'||retdata.buyload_status=='REVERSED'||retdata.buyload_status=='PENDING')) {

                        if(retdata.buyload_status=='PENDING') {

                          var pdata = JSON.parse(data);

                          if(!pdata.pending) {
                            var content = [];
                            content['buyload_status'] = retdata.buyload_status;
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
                          }

                          pdata.timestamp = parseFloat(utils.Moment().format('X'));
                          pdata.checkctr = parseInt(pdata.checkctr) + 1;
                          pdata.pending = 1;

                          localRedis.lpush('ecpcheckloadqueue', JSON.stringify(pdata));

                          resolve(true);
                          return;

                        } else
                        if(retdata.buyload_status=='SUCCESS') {

                          //var pdata = JSON.parse(data);

                          var content = [];
                          content['buyload_status'] = retdata.buyload_status;
                          content['buyload_updatestamp'] = 'now()';

                          if(retdata.buyload_refno) {
                            content['buyload_refno'] =  retdata.buyload_refno;
                          }

                          if(retdata.buyload_txnid) {
                            content['buyload_txnid'] =  retdata.buyload_txnid;
                          }

                          if(retdata.buyload_userbalance) {
                            content['buyload_balance'] = retdata.buyload_userbalance;
                          }

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

                          if(retdata.buyload_refno) {

                            var tcontent = [];
                            tcontent['transaction_loadrefno'] =  retdata.buyload_refno;
                            tcontent['transaction_updatestamp'] = 'now()';

                            var res = await db.Update('tbl_transaction', tcontent, "transaction_id="+wret.pdata.buyload_transid, (client, result) => {
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

                          }

                          var loadProduct = await utils.getEloadProduct(wret.pdata.buyload_pcode, wret.pdata.buyload_provider);

                          //var msg = "Load %productname% for %receiverno% has been completed. Ref:%refno% %date% Bal:P%balance% Tx:%transid%";

                          var curdate = utils.Moment().format("MMM D YYYY h:mma");

                          try {
                            var ubal = numeral(wret.pdata.buyload_userbalance).format('0.00')
                          } catch(e) {
                            var ubal = wret.pdata.buyload_userbalance;
                            console.log(e);
                          }

                          var msg = "Load "+loadProduct.eloadproduct_name+" for "+wret.pdata.buyload_receiverno+" has been completed. Ref:"+wret.retdata.buyload_refno+" "+curdate+" Bal:P"+ubal+" Tx:"+wret.pdata.buyload_transid;

                          //msg = msg.replace('AutoloadMAX','');
                          //msg = msg.replace('Airtime','');

                          //var fcm = {
                          //  key: FCM_SERVER_KEY,
                          //  topic: FCM_DEFAULT_TOPIC+wret.pdata.buyload_userlogin,
                          //  title: 'ecpMessenger',
                          //  body: msg,
                          //}

                          //console.log(fcm);

                          //utils.sendFCM(fcm);

                          var json = {
                            id: await utils.genId(),
                            mobile: wret.pdata.buyload_userlogin,
                            message: msg,
                            senderid: 'ecpMessenger',
                            timestamp: moment().format('x'),
                          };

                          //localRedis.lpush('outbox', JSON.stringify(json), redis.print);

                          localRedis.lpush('ecpinfobox', JSON.stringify(json), redis.print);

                          var balance = {
                            type: 'points',
                            userid: wret.pdata.buyload_userid,
                            mobile: wret.pdata.buyload_userlogin,
                            conid: wret.pdata.buyload_connectionid,
                            balance: ubal,
                            timestamp: utils.unixStamp()
                          }

                          localRedis.lpush('ecpupdatebalance', JSON.stringify(balance), redis.print);

                          resolve(true);
                          return;

                        } else
                        if(retdata.buyload_status=='REVERSED') {

                          var content = [];
                          content['buyload_status'] = retdata.buyload_status;
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

                          try {
                            var ubal = numeral(refundInfo.user_balance).format('0.00')
                          } catch(e) {
                            var ubal = refundInfo.user_balance;
                            console.log(e);
                          }

                          var msg = "Your load request "+loadProduct.eloadproduct_name+" for "+wret.pdata.buyload_receiverno+" has failed and been refunded to you. "+curdate+" Bal:P"+ubal+" Tx:"+refundInfo.trans_id;

                          var json = {
                            id: await utils.genId(),
                            mobile: wret.pdata.buyload_userlogin,
                            message: msg,
                            senderid: 'ecpMessenger',
                            timestamp: moment().format('x'),
                          };

                          //localRedis.lpush('outbox', JSON.stringify(json), redis.print);

                          localRedis.lpush('ecpinfobox', JSON.stringify(json), redis.print);

                          var balance = {
                            type: 'points',
                            userid: wret.pdata.buyload_userid,
                            mobile: wret.pdata.buyload_userlogin,
                            conid: wret.pdata.buyload_connectionid,
                            balance: ubal,
                            timestamp: utils.unixStamp()
                          }

                          localRedis.lpush('ecpupdatebalance', JSON.stringify(balance), redis.print);

                          resolve(true);
                          return;

                        } else {
                          resolve(false);
                          return;
                        }

                      } else {

                        var pdata = JSON.parse(data);

                        pdata.timestamp = parseFloat(utils.Moment().format('X'));
                        pdata.checkctr = parseInt(pdata.checkctr) + 1;

                        localRedis.lpush('ecpcheckloadqueue', JSON.stringify(pdata));

                        resolve(false);
                        return;
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
              return;
            }
          } else {
            //console.log('CHECKLOADSERVER: no data to process');
            resolve(false);
            return;
          }
        }
      });

    });

    var now = parseFloat(utils.Moment().format('X'));

    var elapsed = now - lastdatastamp;

    if(elapsed>300) {
      console.log('CHECKLOADSERVERELAPSED: '+elapsed);
      process.exit(0);
    } else {

      var timeOut = parseInt(_.random(100, 500));

      setTimeout(function(){
        checkLoadLoop();
      }, timeOut);
    }
  }

  async function checkLoop() {

    var db = new Database(pool);

    var utils = new Utils(null, localRedis, db);

    var now = parseFloat(utils.Moment().format('X'));

    var elapsed = now - lastdatastamp;

    if(elapsed>360) {
      console.log('CHECKLOADSERVERCHECKLOOP: '+elapsed);
      process.exit(0);
    } else {

      var timeOut = parseInt(_.random(5000,10000));

      setTimeout(function(){
        console.log('CHECKLOADSERVERCHECKLOOP: working... '+elapsed);
        checkLoop();
      }, timeOut);

    }

  }

  checkLoadLoop();
  checkLoop();
}

main();

// eof
