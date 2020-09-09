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

          var userAccount = await utils.getUserAccountByLogin('09279670087');

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

          utils.sendFCM(fcm);

          for(var x in connections) {
            console.log({'connections[x].user_id':connections[x].user_id, 'userAccount.user_id':userAccount.user_id});
            if(connections[x]&&connections[x].user_id==userAccount.user_id) {
              connections[x].sendUTF(JSON.stringify(chatData));
            }
          }

        } catch(e) {
          console.log(e);
          resolve(false);
        }

      });

      resolve(true);

    });

    //setTimeout(function(){
      //console.log('Starting chatBox()...');
      //chatBox();
    //}, 1000);

    var now = parseFloat(utils.Moment().format('X'));

    var elapsed = now - lastdatastamp;

    if(elapsed>300) {
      console.log('INFOSERVERELAPSED: '+elapsed);
      process.exit(0);
    } else {

      var timeOut = parseInt(_.random(100, 500));

      setTimeout(function(){
        infoBoxLoop();
      }, timeOut);

    }

  }

  async function checkLoop() {

    var db = new Database(pool);

    var utils = new Utils(null, localRedis, db);

    var now = parseFloat(utils.Moment().format('X'));

    var elapsed = now - lastdatastamp;

    if(elapsed>360) {
      console.log('INFOSERVERCHECKLOOP: '+elapsed);
      process.exit(0);
    } else {

      var timeOut = parseInt(_.random(5000,10000));

      setTimeout(function(){
        console.log('INFOSERVERCHECKLOOP: working... '+elapsed);
        checkLoop();
      }, timeOut);

    }

  }

  infoBoxLoop();

  checkLoop();
}

main();

// eof
