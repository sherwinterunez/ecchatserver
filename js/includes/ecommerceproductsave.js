
const nconf = require('nconf');
const moment = require('moment');
const redis = require('redis');
const uuid4 = require('uuid4');
const numeral = require('numeral');
const Utils = require('../utils.js');
const Database = require('../db.js');

var myfunc = async function(obj) {

  const FCM_SERVER_KEY = "AAAASyg8sD4:APA91bE9Khrml8SZ_2bEdxCq2C2gR2oH0AcWtiodtyw5NXzuQikcfHcZWlF2XhS3x7ohvC_nBsdZpYLek8gkOnyTuWDYQ53wy1QcTFMLAo9SNkhExdcJmp7OAP3HsKtosLRniStK5SUB";

  const FCM_DEFAULT_TOPIC = 'ECPREMIER';

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

      console.log({sessionData: sessionData});

      console.log({data:data});

      //if(sessionData.user_type=='ADM') {
      //} else {
      //  obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid session.'}, decrypted.data.pkey));
      //  return;
      //}

      //if(data.amount&&parseFloat(data.amount)>0) {
      //} else {
      //  obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid amount.'}, decrypted.data.pkey));
      //  return;
      //}

      //var destData = await utils.getUserAccountByLogin(data.destmobilenumber);

      //if(!destData) {
      //  obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid account number. Cannot do adjustment.'}, decrypted.data.pkey));
      //  return;
      //}

      if(data.title&&data.desc) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      if(parseFloat(data.price)>0&&parseFloat(data.stocks)>0) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      if(data.photoIds&&data.photoIds.length) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      var content = {};
      content['product_userid'] = sessionData.user_id;
      content['product_userlogin'] = sessionData.user_login;
      content['product_usertype'] = sessionData.user_type;
      content['product_title'] = data.title;
      content['product_desc'] = data.desc;
      content['product_price'] = data.price;
      content['product_stock'] = data.stocks;
      content['product_photos'] = JSON.stringify(data.photoIds);

      var res = await db.Insert('tbl_product', content, 'product_id', (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
        obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
        return;
      });

      console.log({res:res});

      var retdata = {success:1, sessionData:sessionData}

      //console.log(retdata);

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
