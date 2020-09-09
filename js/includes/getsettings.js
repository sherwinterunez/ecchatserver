
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


      if(data.settings) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid parameter.'}, decrypted.data.pkey));
        return;
      }

      var tmp, setting;
      var values = [];

      for(var x in data.settings) {
        for(var y in data.settings[x]) {
          setting = await utils.getOption(y, data.settings[x][y]);
          tmp = {}
          tmp[y] = setting;
          values.push(tmp);
        }
      }


      var retdata = {success:1, settings: values, defaults: data.settings}

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
