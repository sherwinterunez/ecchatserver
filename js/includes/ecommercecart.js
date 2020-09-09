
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

      //if(data.product_id&&data.qty&&parseInt(data.qty)) {
      //} else {
      //  obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
      //  return;
      //}

      //const sql = "select * from (select DISTINCT on (cart_productid) * from tbl_cart where cart_userid='"+sessionData.user_id+"' order by cart_productid, cart_id asc) as a order by cart_id asc";

      const sql = "select * from (select distinct on (B.cart_productid) B.cart_productid,A.qty,B.* from (select cart_userid, cart_productid, sum(cart_qty) as qty from tbl_cart where cart_userid='"+sessionData.user_id+"' group by cart_userid, cart_productid) as A, tbl_cart as B where A.cart_productid=B.cart_productid) as q order by cart_id asc";

      console.log(sql);

      var res = await db.Query(sql, (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
      });

      console.log({res:res});

      if(res&&res.rows&&res.rows.length) {
        for(var x in res.rows) {
          var product = await utils.getEcommerceProductUsingId(res.rows[x].cart_productid);

          product.product_photos = JSON.parse(product.product_photos);

          res.rows[x].product_photos1 = product.product_photos[0];

          res.rows[x].product_title = product.product_title;

          res.rows[x].product = product;
        }
      } else {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'No data found.'}, decrypted.data.pkey));
        return;
      }

      //console.log({data:data});

      var retdata = {success:1, cart:res.rows}

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
