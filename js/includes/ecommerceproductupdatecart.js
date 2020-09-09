
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

      if(data.product_id&&data.qty&&parseInt(data.qty)) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      const sql = "with upsert as (update tbl_cart set cart_qty=cart_qty+"+data.qty+" where cart_userid='"+sessionData.user_id+"' and cart_productid='"+data.product_id+"' returning *) insert into tbl_cart (cart_userid, cart_userlogin, cart_usertype, cart_productid, cart_qty) select '"+sessionData.user_id+"','"+sessionData.user_login+"','"+sessionData.user_type+"','"+data.product_id+"','"+data.qty+"' as insertdata where not exists (select * from upsert)";

      //var content = {};
      //content['cart_userid'] = sessionData.user_id;
      //content['cart_userlogin'] = sessionData.user_login;
      //content['cart_usertype'] = sessionData.user_type;
      //content['cart_productid'] = data.product_id;
      //content['cart_qty'] = data.qty;

      //var res = await db.Insert('tbl_cart', content, 'cart_id', (client, result) => {
      //  client.release();
      //}, (error) => {
      //  console.log('ERROR!');
      //  console.log(error);
      //  obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
      //  return;
      //});

      console.log(sql);

      var res = await db.Query(sql, (client, result) => {
        client.release();
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
        obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
        return;
      });

      console.log({res:res});

      //console.log({data:data});

      var retdata = {success:1}

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
