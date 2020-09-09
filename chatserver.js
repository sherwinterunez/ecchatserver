/*
*
* Author: Sherwin R. Terunez
* Contact: sherwinterunez@yahoo.com
*          sherwinterunez@gmail.com
*
* Date Created: October 11, 2019 9:26AM
*
* Date Updated: July 8, 2020 10:25PM
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
var compression = require('compression');
const express = require('express');
const bodyParser = require('body-parser');
const WebSocketServer = require('websocket').server;
const http = require('http');
const https = require('https');
const sha1 = require('sha1');
const moment = require('moment');
const redis = require('redis');
const uuid4 = require('uuid4');
const request = require('request');
const _ = require("lodash");
const Utils = require('./js/utils.js');
const myrequest = request;

const { Pool, Client } = require('pg');

const Database = require('./js/db.js');

const doRegister = require('./js/includes/register.js');
const doForgotPass = require('./js/includes/forgotpass.js');
const doSignIn = require('./js/includes/signin.js');
const doChangePass = require('./js/includes/changepass.js');
const doPointsTransfer = require('./js/includes/pointstransfer.js');
const doPointsAdjustment = require('./js/includes/pointsadjustment.js');
const doQrPayment = require('./js/includes/qrpayment.js');
const doPointsOut = require('./js/includes/pointsout.js');
const doTransactionHistory = require('./js/includes/transactionhistory.js');
const doELoadTransactions = require('./js/includes/eloadtransactions.js');
const doUploadPhoto = require('./js/includes/uploadphoto.js');
const doUploadProductPhoto = require('./js/includes/uploadproductphoto.js');
const doGetProfile = require('./js/includes/getprofile.js');
const doGetMerchantProfile = require('./js/includes/getmerchantprofile.js');
const doUpdateProfile = require('./js/includes/updateprofile.js');
const doCashRequests = require('./js/includes/cashrequests.js');
const doAllRequests = require('./js/includes/allrequests.js');
const doDeleteConvo = require('./js/includes/deleteconvo.js');
const doChatUploadPhoto = require('./js/includes/chatuploadphoto.js');
const doProducts = require('./js/includes/products.js');
const doBuyLoad = require('./js/includes/buyload.js');
const doManualBuyLoad = require('./js/includes/manualbuyload.js');
const doManualProducts = require('./js/includes/manualproducts.js');
const doManualRegister = require('./js/includes/manualregister.js');
const doManualBalance = require('./js/includes/manualbalance.js');
const doGetSettings = require('./js/includes/getsettings.js');
const doActivateNewELoader = require('./js/includes/activateneweloader.js');
const doActivateMyELoader = require('./js/includes/activatemyeloader.js');
const doGetPartners = require('./js/includes/getpartners.js');
const doEcommerceProductSave = require('./js/includes/ecommerceproductsave.js');
const doEcommerceGetProductPending = require('./js/includes/ecommercegetproductpending.js');
const doEcommerceGetProductLive = require('./js/includes/ecommercegetproductlive.js');
const doEcommerceGetProductReject = require('./js/includes/ecommercegetproductreject.js');
const doEcommerceSetProductStatus = require('./js/includes/ecommercesetproductstatus.js');
const doEcommerceProductAddToCart = require('./js/includes/ecommerceproductaddtocart.js');
const doEcommerceCart = require('./js/includes/ecommercecart.js');

const DEFAULT_PATH = process.cwd();

const pool = new Pool(pgConn);

var credentials = { key: privateKey, cert: certificate, ca: chain };

const chatServer = express();

const appRouter = express.Router();

const sockServer = https.createServer(credentials);

const appServer = https.createServer(credentials, chatServer);

var modemSendQueue = [];

var connections = [];

var modemserver = [];

var conId = 1;

var lastdatastamp = 0;

var config = {
  chatServer: {
    port: 8380,
    websocket: 8390,
  }
}

const localRedis = redis.createClient({host:'127.0.0.1', port:'6379', password:'93ae615c8de441f51695301387beb87bec9c15ca6c613693da3c3bb9cd76'});

chatServer.use(bodyParser.json())

/*
bodyParser = {
  json: {limit: '50mb', extended: true},
  urlencoded: {limit: '50mb', extended: true}
};
*/

chatServer.use(
  bodyParser.json({
    limit: '50mb',
    extended: true,
  })
)
chatServer.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
  })
)

chatServer.use(compression())

//chatServer.use('/images', express.static(DEFAULT_PATH+'/images'))

chatServer.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin', ['*']);
    res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.append('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

async function main() {

  var db = new Database(pool);

  var utils = new Utils(null, localRedis, db);

  await utils.cacheOptions();

  await utils.cacheEloadProducts();

  appRouter.get('/', (request, response) => {
    response.json({ info: 'ChatServer is running.' })
  })

  appRouter.get('/api', (request, response) => {
    response.json({ info: 'Api/ChatServer is running.' })
  })

  appRouter.get('/fcmtoken/:token', (req, res) => {

    var headers = {
      'Authorization': 'key='+FCM_SERVER_KEY,
  		'Content-Type': 'application/json',
    }

    var options = {
      uri: 'https://iid.googleapis.com/iid/info/'+req.params.token+'?details=true',
      method: 'GET',
      headers: headers,
    }

    request(options, function(error, response, body) {
      if(error) {
        response.json({ error: error })
        return;
      }
      //console.log({error: error});
      body = JSON.parse(body);
      //console.log({response: response});
      //console.log({body: body});
      console.log({topics: body.rel.topics});
      res.json({ body: body, topics: body.rel.topics })
    });

  })

  appRouter.get('/chatimage/:image', (request, response) => {
    var fpath = DEFAULT_PATH + '/chatimages/' + request.params.image;

    response.type('image/jpeg');

    fs.access(fpath, fs.F_OK, (err) => {
      if (err) {
        console.error(err)
        response.sendFile(DEFAULT_PATH + '/images/default.jpg');
        return;
      }
      response.sendFile(fpath);
    })
  })

  appRouter.get('/image/:image', (request, response) => {
    var fpath = DEFAULT_PATH + '/images/' + request.params.image;

    response.type('image/jpeg');

    fs.access(fpath, fs.F_OK, (err) => {
      if (err) {
        console.error(err)
        response.sendFile(DEFAULT_PATH + '/images/default.jpg');
        return;
      }
      response.sendFile(fpath);
    })
  })

  appRouter.get('/productimage/:image', (request, response) => {
    var fpath = DEFAULT_PATH + '/productimage/' + request.params.image;

    response.type('image/jpeg');

    fs.access(fpath, fs.F_OK, (err) => {
      if (err) {
        console.error(err)
        response.sendFile(DEFAULT_PATH + '/productimage/default.jpg');
        return;
      }
      response.sendFile(fpath);
    })
  })

  appRouter.get('/tempimage/:image', (request, response) => {
    var fpath = DEFAULT_PATH + '/tempimage/' + request.params.image;

    response.type('image/jpeg');

    fs.access(fpath, fs.F_OK, (err) => {
      if (err) {
        console.error(err)
        response.sendFile(DEFAULT_PATH + '/tempimage/default.jpg');
        return;
      }
      response.sendFile(fpath);
    })
  })

  appRouter.get('/thumb/:image', (request, response) => {
    var fpath = DEFAULT_PATH + '/thumbs/' + request.params.image;

    response.type('image/jpeg');

    fs.access(fpath, fs.F_OK, (err) => {
      if (err) {
        console.error(err)
        response.sendFile(DEFAULT_PATH + '/thumbs/default.jpg');
        return;
      }
      response.sendFile(fpath);
    })
  })

  appRouter.get('/send\.api', async function(request, response) {
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

  appRouter.post('/api', (request, response) => {

    const retError = { error_code:80021, error_message: 'Invalid data received.' };

    //console.log(request.body);

    if(request.body&&request.body.data&&request.body.hash&&request.body.method) {
      try {

        var obj = {request:request.body, response:response, pool:pool, localRedis:localRedis, connections:connections};

        if(request.body.method=='register') {
          doRegister.myFunc(obj);
          return;
        } else
        if(request.body.method=='forgotpass') {
          doForgotPass.myFunc(obj);
          return;
        } else
        if(request.body.method=='signin') {
          doSignIn.myFunc(obj);
          return;
        } else
        if(request.body.method=='changepass') {
          doChangePass.myFunc(obj);
          return;
        } else
        if(request.body.method=='qrpayment') {
          doQrPayment.myFunc(obj);
          return;
        } else
        if(request.body.method=='pointstransfer') {
          doPointsTransfer.myFunc(obj);
          return;
        } else
        if(request.body.method=='pointsadjustment') {
          doPointsAdjustment.myFunc(obj);
          return;
        } else
        if(request.body.method=='pointsout') {
          doPointsOut.myFunc(obj);
          return;
        } else
        if(request.body.method=='transactionhistory') {
          doTransactionHistory.myFunc(obj);
          return;
        } else
        if(request.body.method=='eloadtransactions') {
          doELoadTransactions.myFunc(obj);
          return;
        } else
        if(request.body.method=='uploadphoto') {
          doUploadPhoto.myFunc(obj);
          return;
        } else
        if(request.body.method=='uploadproductphoto') {
          doUploadProductPhoto.myFunc(obj);
          return;
        } else
        if(request.body.method=='getprofile') {
          doGetProfile.myFunc(obj);
          return;
        } else
        if(request.body.method=='getmerchantprofile') {
          doGetMerchantProfile.myFunc(obj);
          return;
        } else
        if(request.body.method=='updateprofile') {
          doUpdateProfile.myFunc(obj);
          return;
        } else
        if(request.body.method=='cashrequests') {
          doCashRequests.myFunc(obj);
          return;
        } else
        if(request.body.method=='allrequests') {
          doAllRequests.myFunc(obj);
          return;
        } else
        if(request.body.method=='deleteconvo') {
          doDeleteConvo.myFunc(obj);
          return;
        } else
        if(request.body.method=='chatuploadphoto') {
          doChatUploadPhoto.myFunc(obj);
          return;
        } else
        if(request.body.method=='products') {
          doProducts.myFunc(obj);
          return;
        } else
        if(request.body.method=='buyload') {
          doBuyLoad.myFunc(obj);
          return;
        } else
        if(request.body.method=='manualbuyload') {
          doManualBuyLoad.myFunc(obj);
          return;
        } else
        if(request.body.method=='manualproducts') {
          doManualProducts.myFunc(obj);
          return;
        } else
        if(request.body.method=='manualregister') {
          doManualRegister.myFunc(obj);
          return;
        } else
        if(request.body.method=='manualbalance') {
          doManualBalance.myFunc(obj);
          return;
        } else
        if(request.body.method=='getsettings') {
          doGetSettings.myFunc(obj);
          return;
        } else
        if(request.body.method=='activateneweloader') {
          doActivateNewELoader.myFunc(obj);
          return;
        } else
        if(request.body.method=='activatemyeloader') {
          doActivateMyELoader.myFunc(obj);
          return;
        } else
        if(request.body.method=='getpartners') {
          doGetPartners.myFunc(obj);
          return;
        } else
        if(request.body.method=='ecommerceproductsave') {
          doEcommerceProductSave.myFunc(obj);
          return;
        } else
        if(request.body.method=='ecommercegetproductpending') {
          doEcommerceGetProductPending.myFunc(obj);
          return;
        } else
        if(request.body.method=='ecommercegetproductlive') {
          doEcommerceGetProductLive.myFunc(obj);
          return;
        } else
        if(request.body.method=='ecommercegetproductreject') {
          doEcommerceGetProductReject.myFunc(obj);
          return;
        } else
        if(request.body.method=='ecommercesetproductstatus') {
          doEcommerceSetProductStatus.myFunc(obj);
          return;
        } else
        if(request.body.method=='ecommerceproductaddtocart') {
          doEcommerceProductAddToCart.myFunc(obj);
          return;
        } else
        if(request.body.method=='ecommercecart') {
          doEcommerceCart.myFunc(obj);
          return;
        }

      } catch(e) {
        console.log(e);
        response.json(retError);
        return;
      }
    } else {
      response.json(retError);
      return;
    }

    response.json(retError);
  })

  chatServer.use('/', appRouter);

  appServer.listen(config.chatServer.port, () => {
    console.log(`ChatServer listening on port ${config.chatServer.port}.`)
  })

  sockServer.listen(config.chatServer.websocket, () => {
    console.log(`WebSocketServer is listening on port ${config.chatServer.websocket}.`);
  });

  wsServer = new WebSocketServer({
    httpServer: sockServer
  });

  // WebSocket server
  wsServer.on('request', function(request) {
    var connection = request.accept(null, request.origin);
    var hInterval;
    var mInterval;
    var cTimeout;
    var utils = new Utils();

    var myConId = utils.uuid4();

    console.log((new Date()) + ' Connection from origin ['
          + request.origin + ']');

    if(request.origin=='https://modemserver.local') {
      connection.ImAmodem = true;
      modemserver[myConId] = connection;
      connection.sendUTF(JSON.stringify({ type: 'modeminit', timestamp: utils.unixStamp()} ));

      function modemLoop() {

        if(modemSendQueue&&modemSendQueue.length>0) {
          var data = modemSendQueue.shift();
          connection.sendUTF(data);
        }

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
      connections[myConId] = connection;

      cTimeout = setTimeout(function(){
        try {
          if(connections[myConId]) {
            connections[myConId].close();
          }
        } catch(e) {
          console.log(e);
        }
      }, 10000)
    }

    // This is the most important callback for us, we'll handle
    // all messages from users here.
    connection.on('message', async function(message) {
      var self = this;

      if (message.type === 'utf8') {
        message.remoteAddresss = connection.remoteAddress;
        ///console.log(message);

        try {

          var db = new Database(pool);

          var utils = new Utils(null, localRedis, db);

          var json = JSON.parse(message.utf8Data);

          if(json.type == 'auth') {
            //console.log(json);
            //clearTimeout(cTimeout);

            localRedis.hget('ecpsessions', 'SID'+json.sid, function(err, sessionData){
              try {
                var sdata = JSON.parse(sessionData);

                console.log(sdata);

                if(sdata.id==json.sid) {
                  self.user_id = sdata.user_id;
                  //connections[myConId].userData = {
                  //  id: sdata.user_id,
                  //  login: sdata.user_login,
                  //  type: sdata.user_type,
                  //}
                  //console.log(connections[myConId].userData);
                  clearTimeout(cTimeout);
                  self.sendUTF(JSON.stringify({ type: 'authorized', uid: myConId, timestamp: utils.unixStamp()} ));
                }
              } catch(e) {
                console.log(e);
              }
            });

          } else
          if(json.type == 'fcmtopics' && json.token) {

            var headers = {
              'Authorization': 'key='+FCM_SERVER_KEY,
          		'Content-Type': 'application/json',
            }

            var options = {
              uri: 'https://iid.googleapis.com/iid/info/'+json.token+'?details=true',
              method: 'GET',
              headers: headers,
            }

            myrequest(options, function(error, response, body) {
              if(error) {
                console.log({ error: error })
                return;
              }

              try {
                body = JSON.parse(body);

                console.log({topics: body.rel.topics});

                self.sendUTF(JSON.stringify({ type: 'fcmtopics', topics: body.rel.topics, timestamp: utils.unixStamp()} ));

              } catch(e) {
                console.log(e);
              }
            });

          } else
          if(json.type == 'pingtest') {
            self.sendUTF(JSON.stringify({ type: 'pong', msgid:json.msgid, timestamp: utils.unixStamp()} ));
          } else
          if(json.type == 'init') {
            //self.sendUTF(JSON.stringify({ type: 'pong', timestamp: utils.unixStamp()} ));
            //self.user_id = json.userid;

            var sql = "select * from (select distinct on (message_fruserid) * from tbl_message where message_ownerid='"+json.userid+"' and message_userid='"+json.userid+"' order by message_fruserid,message_id desc limit 20) a order by message_id desc";

            //var sql = "select * from (select distinct on (message_fruserid) * from tbl_message where message_ownerid='"+json.userid+"' order by message_fruserid,message_id desc limit 20) a order by message_id desc";

            console.log(sql);
            db.Query(sql, async (client, result) => {
              client.release();
              console.log(result);

              var points = await utils.getMyPointsById(json.userid);

              var balance = {
                type: 'points',
                userid: json.userid,
                mobile: json.userlogin,
                balance: points,
                timestamp: utils.unixStamp()
              }

              localRedis.lpush('ecpupdatebalance', JSON.stringify(balance), redis.print);

              if(result&&result.rowCount) {

                for(var x in result.rows) {

                  var row = result.rows[x];

                  var obj = {
                    type: 'chatlist',
                    text: row.message_text,
                    messageid: row.message_id,
                    userid: row.message_fruserid,
                    userlogin: row.message_fruserlogin,
                    userfullname: row.message_fruserfullname,
                    userinfo:
                    {
                      user_id: row.message_fruserid,
                      user_login: row.message_fruserlogin,
                      user_firstname: row.message_fruserfirstname,
                      user_middlename: row.message_frusermiddlename,
                      user_lastname: row.message_fruserlastname
                    },
                    touserid: row.message_userid,
                    touserlogin: row.message_userlogin,
                    timestamp: utils.unixStamp(),
                  };

                  self.sendUTF(JSON.stringify(obj));
                }

                //self.sendUTF(JSON.stringify({ type: 'init', count: result.rowCount, result: result.rows, timestamp: utils.unixStamp()} ));
              }
            }, (error) => {
              console.log('ERROR!');
              console.log(error);
            });

            console.log(json);
            return;
          } else
          if(json.type == 'ping') {
            self.sendUTF(JSON.stringify({ type: 'pong', timestamp: utils.unixStamp()} ));
            return;
          } else
          if(json.type == 'chatinit') {
            //self.sendUTF(JSON.stringify({ type: 'pong', timestamp: utils.unixStamp()} ));

            //var content = [];
            //content['room_name'] = utils.uuid4();

            //var res = await db.Insert('tbl_room', content, 'room_id', (client, result) => {
            //  client.release();
            //  console.log(result);
            //}, (error) => {
            //  console.log('ERROR!');
            //  console.log(error);
            //});

            console.log(json);

            var limit = 100;
            var offset = 0;

            var sql = "select * from tbl_message where message_ownerid='"+json.userid+"' and ((message_userid='"+json.userid+"' and message_fruserid='"+json.touserid+"') or (message_userid='"+json.touserid+"' and message_fruserid='"+json.userid+"')) order by message_id desc limit "+limit+" offset "+offset;

            sql = "select * from ("+sql+") a order by message_id asc";

            console.log(sql);

            db.Query(sql, (client, result) => {
              client.release();
              //console.log(result);

              if(result&&result.rowCount) {
                console.log(result);
                self.sendUTF(JSON.stringify({ type: 'chatinit', count: result.rowCount, result: result.rows, timestamp: utils.unixStamp()} ));
              }
            }, (error) => {
              console.log('ERROR!');
              console.log(error);
            });

            return;
          } else
          if(json.type == 'search') {
            console.log(json);

            var limit = 20;
            var offset = 0;
            var sort = 'asc';

            var query = json.query;

            var aquery = query.split(' ');

            var where = '';

            var awhere = [];

            for(var x in aquery) {
              awhere.push(aquery[x]+':*')
            }

            where = awhere.join(' | ');

            var sql = "select * from (select user_id,user_login,user_firstname,user_lastname,user_middlename,user_tsvector from tbl_user, to_tsquery('"+where+"') as q where (user_tsvector @@ q)) as t1 order by ts_rank_cd(t1.user_tsvector, to_tsquery('"+where+"')) desc;";

            db.Query(sql, (client, result) => {
              client.release();
              console.log(result);

              if(result&&result.rowCount) {
                self.sendUTF(JSON.stringify({ type: 'search', count: result.rowCount, result: result.rows, timestamp: utils.unixStamp()} ));
              }
            }, (error) => {
              console.log('ERROR!');
              console.log(error);
            });


            return;
          } else
          if(json.type == 'chat') {
            console.log(json);

            var content = [];
            content['message_text'] = json.text;
            content['message_userid'] = json.touserid;
            content['message_userlogin'] = json.touserlogin;
            content['message_fruserfullname'] = json.userfullname;
            content['message_fruserid'] = json.userid;
            content['message_fruserlogin'] = json.userlogin;
            content['message_fruserfirstname'] = json.userinfo.user_firstname;
            content['message_fruserlastname'] = json.userinfo.user_lastname;
            content['message_frusermiddlename'] = json.userinfo.user_middlename;
            content['message_ownerid'] = json.touserid;

            var res = await db.Insert('tbl_message', content, 'message_id', (client, result) => {
              client.release();
              console.log(result);
            }, (error, client, mysql) => {
              console.log('ERROR!');
              console.log('SQL: '+mysql);
              console.log(error);
            });

            var message_id = 0;

            try {
              message_id = res.rows[0].message_id;
            } catch(e) {
              console.log(e);
            }

            content['message_ownerid'] = json.userid;

            var res = await db.Insert('tbl_message', content, 'message_id', (client, result) => {
              client.release();
              console.log(result);
            }, (error, client, mysql) => {
              console.log('ERROR!');
              console.log('SQL: '+mysql);
              console.log(error);
            });

            json.messageid = message_id;

            //sendFCM(json.touserlogin, json.userfullname, json.text);

            var fcm = {
              key: FCM_SERVER_KEY,
              //topic: '/topics/'+FCM_DEFAULT_TOPIC+json.touserlogin,
              topic: FCM_DEFAULT_TOPIC+json.touserlogin,
              title: json.userfullname,
              body: json.text,
            }

            utils.sendFCM(fcm);

            for(var x in connections) {
              if(connections[x]&&connections[x].user_id==json.touserid) {
                connections[x].sendUTF(JSON.stringify(json));
              }
              //if(x==myConId) {
                //console.log('Connections: '+connections[x].myId);
                //connection.sendUTF(message.utf8Data);
              //} else {
                //console.log('Connections: '+connections[x].myId);
                //connection.sendUTF(message.utf8Data);
                //message.utf8Data.type = 'chat';
                //json.type = 'chat';
                //connections[x].sendUTF(JSON.stringify(json));
              //}
            }
          }

        } catch(e) {
          console.log(e);
        }
      }
    });

    connection.on('close', function(connection) {
      var self = this;

      console.log('Connection closed.');

      if(self.ImAmodem) {
        delete modemserver[myConId];
      } else {
        delete connections[myConId];
      }
      //clearInterval(hInterval);
      //console.log(connections);
      // close user connection
    });

    //hInterval = setInterval(function(){
      //connection.sendUTF(JSON.stringify({ type: 'ping', data: 'Welcome, Sherwin!'} ));
    //}, 10000);
  });

  //cron();
  updateBalance();
  infoBoxLoop();
}

async function updateBalance() {

  await new Promise((resolve, reject) => {

    var db = new Database(pool);

    var utils = new Utils(null, localRedis, db);

    localRedis.rpop("ecpupdatebalance", async (err, data) => {

      if(err) {
        resolve(false);
        return;
      }

      if(data==null) {
        resolve(false);
        return;
      }

      try {
        var json = JSON.parse(data);

        console.log({ecpupdatebalance: data});

        if(json.conid) {
          try {
            connections[json.conid].sendUTF(data);
          } catch(e) {
            console.log(e);
          }
        }

        if(json.userid) {
          for(var x in connections) {
            if(connections[x]&&connections[x].user_id&&connections[x].user_id==json.userid) {
              try {
                connections[x].sendUTF(data);
              } catch(e) {
                console.log(e);
              }
            }
          }

        }

        resolve(true);

      } catch(e) {
        console.log(e);
        resolve(false);
      }

    });

  });

  setTimeout(function(){
    //console.log('Starting chatBox()...');
    updateBalance();
  }, 100);

}


async function sendFCM(mytopic, mytitle, mybody) {

  var topic = '/topics/' + FCM_DEFAULT_TOPIC;

  if(mytopic) {
    topic += mytopic;
  }

  var title = 'Sample Title';
  var body = 'This is a sample body message.';

  if(mytitle) {
    title = mytitle;
  }

  if(mybody) {
    body = mybody;
  }

  var msg = {
    title: title,
    body: body,
    sound: 'default',
    click_action: 'FCM_PLUGIN_ACTIVITY',
    //'icon': 'fcm_push_icon',
    high_priority: 'high',
		show_in_foreground: true
  }

  var data = {
    'title': title,
    'body': body,
    'timestamp': moment().format('x'),
  }

  var fields = {
    to: topic,
		notification: msg,
		delay_while_idle: false,
		content_available: true,
    priority: 'high',
    time_to_live: 86400,
    data: data,
  }

  var headers = {
    'Authorization': 'key='+FCM_SERVER_KEY,
		'Content-Type': 'application/json',
  }

  var options = {
    uri: 'https://fcm.googleapis.com/fcm/send',
    method: 'POST',
    json: fields,
    headers: headers,
  }

  request(options, function(error, response, body) {
    console.log({error: error});
    console.log({response: response});
    console.log({body: body});
  });

}

async function infoBoxLoop() {

  var db = new Database(pool);

  var utils = new Utils(null, localRedis, db);

  if(lastdatastamp<1) {
    lastdatastamp = parseFloat(utils.Moment().format('X'));
  }

  var status = await new Promise((resolve, reject) => {

    localRedis.rpop("ecpinfobox", async (err, data) => {

      if(data==null) {
        resolve(false);
        return;
      }

      try {
        var json = JSON.parse(data);

        console.log({ecpinfobox: json});

        var userAccount = await utils.getUserAccountByLogin(json.mobile);

        if(!userAccount) {
          resolve(false);
          return;
        }

        var schoolAccount = await utils.getUserAccountByLogin('09568271338');

        if(!schoolAccount) {
          resolve(false);
          return;
        }

        lastdatastamp = parseFloat(utils.Moment().format('X'));

        console.log({json:json});

        //console.log(userAccount);

        //console.log(schoolAccount);

        var content = [];
        content['message_text'] = json.message;
        content['message_userid'] = userAccount.user_id;
        content['message_userlogin'] = userAccount.user_login;
        content['message_fruserfullname'] = schoolAccount.fullname;
        content['message_fruserid'] = schoolAccount.user_id;
        content['message_fruserlogin'] = schoolAccount.user_login;
        content['message_fruserfirstname'] = schoolAccount.user_firstname;
        content['message_fruserlastname'] = schoolAccount.user_lastname;
        content['message_frusermiddlename'] = schoolAccount.user_middlename;
        content['message_ownerid'] = userAccount.user_id;

        var res = await db.Insert('tbl_message', content, 'message_id', (client, result) => {
          client.release();
          console.log(result);
        }, (error, client, mysql) => {
          console.log('ERROR!');
          console.log('SQL: '+mysql);
          console.log(error);
        });

        if(res) {
        } else {
          resolve(false);
          return;
        }

        var message_id = 0;

        try {
          message_id = res.rows[0].message_id;
        } catch(e) {
          console.log(e);
        }

        var fcm = {
          key: FCM_SERVER_KEY,
          //topic: '/topics/'+FCM_DEFAULT_TOPIC+json.touserlogin,
          topic: FCM_DEFAULT_TOPIC+userAccount.user_login,
          title: schoolAccount.fullname,
          body: json.message,
        }

        var chatData = {
          type: 'chat',
          messageid: message_id,
          text: json.message,
          userid: schoolAccount.user_id,
          userlogin: schoolAccount.user_login,
          userfullname: schoolAccount.fullname,
          userinfo: {
            user_id: schoolAccount.user_id,
            user_login: schoolAccount.user_login,
            user_firstname: schoolAccount.user_firstname,
            user_middlename: schoolAccount.user_middlename,
            user_lastname: schoolAccount.user_lastname,
          },
          touserid: userAccount.user_id,
          touserlogin: userAccount.user_login,
          timestamp: utils.unixStamp(),
        }

        try {

          utils.sendFCM(fcm);

          for(var x in connections) {
            console.log({'connections[x].user_id':connections[x].user_id, 'userAccount.user_id':userAccount.user_id});
            if(connections[x]&&connections[x].user_id==userAccount.user_id) {
              connections[x].sendUTF(JSON.stringify(chatData));
            }
          }
        } catch(e) {
          console.log(e);
        }

        resolve(true);

      } catch(e) {
        console.log(e);
        resolve(false);
      }

    });

  });

  //setTimeout(function(){
    //console.log('Starting chatBox()...');
    //chatBox();
  //}, 1000);

  var now = parseFloat(utils.Moment().format('X'));

  var elapsed = now - lastdatastamp;

  if(elapsed>300) {
    console.log('INFOSERVERELAPSED: '+elapsed);
    lastdatastamp = parseFloat(utils.Moment().format('X'));
    //process.exit(0);
  } //else {

    var timeOut = parseInt(_.random(100, 500));

    setTimeout(function(){
      infoBoxLoop();
    }, timeOut);

  //}

}


main();

// eof
