
const nconf = require('nconf');
const moment = require('moment');
const redis = require('redis');
const uuid4 = require('uuid4');
const Utils = require('../utils.js');
const Database = require('../db.js');

var myfunc = async function(obj) {

  var db = new Database(obj.pool);

  var localRedis = obj.localRedis;

  var utils = new Utils(null, localRedis, db);

  try {

    var decrypted = utils.Decrypt(obj.request);

    console.log({decrypted:decrypted});

    if(decrypted.data) {

      var data = decrypted.data;

      if(!data.session) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid session.'}, decrypted.data.pkey));
        return;
      }

      var sessionData = await utils.getSessionData('SID'+data.session);

      if(!sessionData) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid session.'}, decrypted.data.pkey));
        return;
      }

      console.log(sessionData);

      if(!utils.isValidMobileNumber(sessionData.user_login)) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid mobile number.'}, decrypted.data.pkey));
        return;
      }

      var userAccount = await utils.getUserAccountByLogin(sessionData.user_login);

      if(userAccount) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid account number.'}, decrypted.data.pkey));
        return;
      }

      var sql;
      var ferror = false;

      if(data.userid) {

        var dbClient = await db.Connect();

        await db.Query('BEGIN', null, null, dbClient);
        //await db.Query('LOCK TABLE tbl_transaction IN EXCLUSIVE MODE', null, null, dbClient);

        sql = 'DELETE FROM tbl_message WHERE message_ownerid='+sessionData.user_id+' and message_userid='+data.userid+' AND message_fruserid='+sessionData.user_id;

        var res = await db.Query(sql, (client, result) => {
          //client.release();
          //console.log(result);
        }, (error) => {
          db.Query('ROLLBACK', null, null, dbClient);
          console.log('ERROR!');
          console.log(error);
          obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          ferror = true;
          return;
        }, dbClient);

        if(ferror) {
          return;
        }

        sql = 'DELETE FROM tbl_message WHERE message_ownerid='+sessionData.user_id+' and message_userid='+sessionData.user_id+' AND message_fruserid='+data.userid;

        var res = await db.Query(sql, (client, result) => {
          //client.release();
          //console.log(result);
        }, (error) => {
          db.Query('ROLLBACK', null, null, dbClient);
          console.log('ERROR!');
          console.log(error);
          obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          ferror = true;
          return;
        }, dbClient);

        if(ferror) {
          return;
        }

        await db.Query('COMMIT', null, null, dbClient);

        dbClient.release();
      }

      var retdata = {success:1, deleteconvo: 1}

      var ret = utils.Encrypt(retdata, decrypted.data.pkey);

      obj.response.json(ret);
    }

  } catch(e) {
    console.log(e);
  }

  obj.response.json({error_code:90020, error_message:'Invalid operation.'});
}

exports.myFunc = myfunc;
