
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

      var userinfo = await utils.getUserAccountByLogin(sessionData.user_login);

      if(!userinfo) {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Account does not exists.'}, decrypted.data.pkey));
        return;
      }

      if(!data.mobilenumber) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid mobile number.'}, decrypted.data.pkey));
        return;
      }

      if(!utils.isValidMobileNumber(data.mobilenumber)) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid mobile number.'}, decrypted.data.pkey));
        return;
      }

      var accountinfo = await utils.getUserAccountByLogin(data.mobilenumber);

      if(!accountinfo) {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid Account.'}, decrypted.data.pkey));
        return;
      }

      if(accountinfo.user_type=='MERCHANT') {
      } else {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Not a Merchant Account.'}, decrypted.data.pkey));
        return;
      }

      delete accountinfo.user_salt;
      delete accountinfo.user_hash;

      var retdata = {success:1, update: 1, userinfo: accountinfo}

      console.log(retdata);

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
