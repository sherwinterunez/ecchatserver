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
* Sign-in Module.
*
*/

const fs = require('fs');
const path = require('path');
const nconf = require('nconf');
const redis = require('redis');

const Utils = require('../utils.js');
const Database = require('../db.js');

const DEFAULT_PATH = path.dirname(process.argv[1]);

var myfunc = async function(obj) {

  var db = new Database(obj.pool);

  var localRedis = obj.localRedis;

  var utils = new Utils(null, localRedis, db);

  try {

    var decrypted = utils.Decrypt(obj.request);

    console.log({decrypted:decrypted});

    if(decrypted.data) {

      var data = decrypted.data;

      var serverOffline = await utils.getOption('$SETTINGS_SERVEROFFLINE', 0);

      if(parseInt(serverOffline)) {
        obj.response.json(utils.Encrypt({error_code:90025, error_message:'Server is currently unavailable.'}, decrypted.data.pkey));
        return;
      }

      var serverMaintenance = await utils.getOption('$SETTINGS_SERVERMAINTENANCE', 0);

      if(parseInt(serverMaintenance)) {
        obj.response.json(utils.Encrypt({error_code:90025, error_message:'Ongoing server maintenance.'}, decrypted.data.pkey));
        return;
      }

      if(data.username&&data.hash) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90025, error_message:'Invalid data received.'}, decrypted.data.pkey));
        return;
      }

      const sql = "SELECT * FROM tbl_user WHERE user_login='"+data.username+"'";

      console.log(sql);

      var res = await db.Query(sql, (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
      });

      //console.log(res);

      var userinfo = await utils.getUserAccountByLogin(data.username);

      if(!userinfo) {
        obj.response.json(utils.Encrypt({error_code:90023, error_message:'Invalid username/password.'}, decrypted.data.pkey));
        return;
      }

      if(userinfo.user_status==1) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90023, error_message:'Invalid username/password.'}, decrypted.data.pkey));
        return;
      }

      //var userinfo = res.rows[0];

      var user_id = userinfo.user_id;

      var user_hash = userinfo.user_hash;

      var gkey = userinfo.user_salt;

      var str = utils.sha1(data.hash);

      var giv = str.substr(0, 32);

      var key = utils.CryptoJS.enc.Hex.parse(gkey);

      var iv =  utils.CryptoJS.enc.Hex.parse(giv);

      var ct = utils.CryptoJS.AES.encrypt(data.hash, key, { iv: iv });

      var encrypted = ct.ciphertext.toString(utils.CryptoJS.enc.Base64);

      console.log('user_hash: '+user_hash);
      console.log('encrypted: '+encrypted);

      if(user_hash==encrypted) {

        delete userinfo.user_salt;
        delete userinfo.user_hash;

        if(userinfo.user_temppass) {
          userinfo.user_temppass = 1;
        } else {
          delete userinfo.user_temppass;
        }

        var sessionId = await utils.genId(3, 'ecpsessionid');

        var sessionData = {
          id: sessionId,
          user_id: userinfo.user_id,
          user_login: userinfo.user_login,
          user_type: userinfo.user_type,
          userinfo: userinfo
        }

        var fullname = [];

        if(userinfo.user_firstname) {
          fullname.push(userinfo.user_firstname);
        }

        if(userinfo.user_middlename) {
          fullname.push(userinfo.user_middlename);
        }

        if(userinfo.user_lastname) {
          fullname.push(userinfo.user_lastname);
        }

        sessionData.fullname = fullname.join(' ');

        localRedis.hset('ecpsessions','SID'+sessionId,JSON.stringify(sessionData), redis.print)

        userinfo.photo = userinfo.user_id+'.jpg';

        var retdata = {success:1, signin: 1, userinfo: userinfo, sessionid:sessionId}

        retdata.userinfo.fullname = sessionData.fullname;

        console.log(retdata);

        var ret = utils.Encrypt(retdata, decrypted.data.pkey);

        obj.response.json(ret);

        var content = [];
        content['user_loginstamp'] = 'now()';

        var res = await db.Update('tbl_user', content, "user_id='"+user_id+"'", (client, result) => {
          client.release();
          console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
        });

        return;
      }

      obj.response.json(utils.Encrypt({error_code:90024, error_message:'Invalid username/password.'}, decrypted.data.pkey));
      return;
    }

  } catch(e) {
    console.log(e);
  }

  obj.response.json({error_code:90020, error_message:'Invalid operation.'});
}

exports.myFunc = myfunc;
