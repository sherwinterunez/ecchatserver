
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
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid account number. Cannot cash out.'}, decrypted.data.pkey));
        return;
      }

      if(data.close&&parseFloat(data.close)>0) {
        var content = [];
        content['cashout_status'] = '0';
        content['cashout_updatestamp'] = 'now()';

        var res = await db.Update('tbl_cashout', content, "cashout_id='"+data.close+"'", (client, result) => {
          client.release();
          console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
        });
      }

      var userAccount = await utils.getUserAccountByLogin(sessionData.user_login);

      for(var x in obj.connections) {
        if(obj.connections[x]&&obj.connections[x].user_id&&obj.connections[x].user_id==userAccount.user_id) {
          obj.connections[x].sendUTF(JSON.stringify({ type: 'points', balance: userAccount.user_loadwallet, cashout: userAccount.user_cashout, timestamp: utils.unixStamp()} ));
        }
      }

      var sql = "SELECT * FROM tbl_cashout WHERE cashout_status=1 ORDER BY cashout_id ASC";

      console.log(sql);

      var res = await db.Query(sql, (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
      });

      console.log(res);

      if(res&&res.rows&&res.rows.length) {
        var arows = [];

        for(var x in res.rows) {
          res.rows[x].fullname = await utils.getUserFullNameById(res.rows[x].cashout_userid);
        }

        var retdata = {success:1, cashrequests: res.rows}

        var ret = utils.Encrypt(retdata, decrypted.data.pkey);

        obj.response.json(ret);
      } else {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'No cash requests found.'}, decrypted.data.pkey));
      }


      return;
    }

  } catch(e) {
    console.log(e);
  }

  obj.response.json({error_code:90020, error_message:'Invalid operation.'});
}

exports.myFunc = myfunc;
