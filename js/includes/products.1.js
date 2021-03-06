
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

      if(!data.mobilenumber) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      var network = utils.checkNetwork(data.mobilenumber);

      if(!network) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid mobile number.'}, decrypted.data.pkey));
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

      var products = {};
      var forall = {};

      var myproducts = await utils.getProducts(network);

      if(myproducts) {
        var subcarrier='';
        var tmp = [];
        for(var x in myproducts) {
          if(myproducts[x].eloadproduct_subcarrier!=subcarrier) {
            console.log(tmp);
            if(tmp&&tmp.length) {
              products[subcarrier] = tmp;
            }
            tmp = [];
            subcarrier = myproducts[x].eloadproduct_subcarrier;
          }
          tmp.push(myproducts[x]);
        }
        if(tmp&&tmp.length) {
          products[subcarrier] = tmp;
        }
      }

      var all = await utils.getProducts('all');

      if(all) {
        var subcarrier='';
        var tmp = [];
        for(var x in all) {
          //console.log(all[x]);
          if(all[x].eloadproduct_subcarrier!=subcarrier) {
            console.log(tmp);
            if(tmp&&tmp.length) {
              forall[subcarrier] = tmp;
            }
            tmp = [];
            subcarrier = all[x].eloadproduct_subcarrier;
          }
          tmp.push(all[x]);
        }
        if(tmp&&tmp.length) {
          forall[subcarrier] = tmp;
        }
      }

      var retdata = {success:1, products: products, forall: forall, network: network}

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
