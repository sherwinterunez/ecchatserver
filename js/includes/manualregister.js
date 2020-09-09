
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

      if(!data.type) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      if(!data.fbid) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      if(data.type=='register') {

        if(!data.mobilenumber) {
          obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
          return;
        }

        if(!utils.isValidMobileNumber(data.mobilenumber)) {
          obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid mobile number.'}, decrypted.data.pkey));
          return;
        }

        var network = utils.checkNetwork(data.mobilenumber);

        if(!network) {
          obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid mobile number.'}, decrypted.data.pkey));
          return;
        }

        var userAccount = await utils.getUserAccountByLogin(data.mobilenumber);

        if(userAccount) {
        } else {
          obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid account number.'}, decrypted.data.pkey));
          return;
        }

        if(userAccount.user_buyloadstatus) {
        } else {
          obj.response.json(utils.Encrypt({error_code:90022, error_message:'Your eLoader account is not yet activated.'}, decrypted.data.pkey));
          return;
        }

        var sql = "select * from tbl_user where user_fbid='"+data.fbid+"' and user_login<>'"+data.mobilenumber+"'";

        var res = await db.Query(sql, (client, result) => {
          client.release();
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          return;
        });

        if(res&&res.rowCount) {
          obj.response.json(utils.Encrypt({error_code:90022, error_message:'Sorry, this messenger account is already registered.'}, decrypted.data.pkey));
          return;
        }

        var code = utils.getRandomInt(100000,999999);

        var content = [];
        content['user_fbvcode'] = code;
        content['user_fbid'] = data.fbid;
        content['user_fbverified'] = 0;
        content['user_updatestamp'] = 'now()';

        var res = await db.Update('tbl_user', content, "user_login='"+data.mobilenumber+"'", (client, result) => {
          client.release();
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          return;
        });

        var msg = 'VER'+code+' is your Verification Code.';

        var json = {
          id: await utils.genId(),
          mobile: data.mobilenumber,
          message: msg,
          timestamp: moment().format('x'),
        };

        localRedis.lpush('outbox', JSON.stringify(json), redis.print);

      } else
      if(data.type=='verify') {

        if(!data.code) {
          obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
          return;
        }

        var sql = "select * from tbl_user where user_fbid='"+data.fbid+"' and user_fbvcode='"+data.code+"' and user_fbverified=0";

        var res = await db.Query(sql, (client, result) => {
          client.release();
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          return;
        });

        if(res&&res.rowCount) {
          console.log({rows: res.rows});

          var content = [];
          content['user_fbvcode'] = '';
          content['user_fbid'] = data.fbid;
          content['user_fbverified'] = 1;
          content['user_updatestamp'] = 'now()';
          content['user_fbverifiedstamp'] = 'now()';

          var res = await db.Update('tbl_user', content, "user_id='"+res.rows[0].user_id+"'", (client, result) => {
            client.release();
            //console.log(result);
          }, (error) => {
            console.log('ERROR!');
            console.log(error);
            obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
            return;
          });

        } else {
          obj.response.json(utils.Encrypt({error_code:91001, error_message:'Error.'}, decrypted.data.pkey));
          return;
        }

      } else {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      var retdata = {success:1, data:data}

      var ret = utils.Encrypt(retdata, decrypted.data.pkey);

      obj.response.json(ret);

      return;
    }

  } catch(e) {
    console.log(e);
  }

  obj.response.json({error_code:90020, error_message:'Invalid operation.'});
}

exports.myFunc = myfunc;
