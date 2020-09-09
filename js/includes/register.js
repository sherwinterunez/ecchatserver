
const nconf = require('nconf');
const moment = require('moment');
const redis = require('redis');
const uuid4 = require('uuid4');
const Utils = require('../utils.js');
const Database = require('../db.js');

var myfunc = async function(obj) {

  var db = new Database(obj.pool);

  var localRedis = obj.localRedis;

  var utils = new Utils(null, localRedis);

  try {

    var decrypted = utils.Decrypt(obj.request);

    console.log({decrypted:decrypted});

    if(decrypted.data) {

      var data = decrypted.data;

      if(!utils.isValidMobileNumber(data.mobilenumber)) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid mobile number.'}, decrypted.data.pkey));
        return;
      }

      const sql = "SELECT * FROM tbl_user WHERE user_login='"+data.mobilenumber+"'";

      console.log(sql);

      var res = await db.Query(sql, (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
      });

      //console.log(res);

      if(res&&res.rowCount) {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Mobile number is already registered.'}, decrypted.data.pkey));
        return;
      }

      var content = {};
      content['user_login'] = data.mobilenumber;
      content['user_lastname'] = data.lastname;
      content['user_firstname'] = data.firstname;
      content['user_middlename'] = data.middlename;
      content['user_gender'] = data.gender;

      var tempPass = utils.getRandomInt(100000,999999);

      //console.log('tempPass: '+tempPass);

      content['user_temppass'] = tempPass;

      var credential = data.mobilenumber+'|'+tempPass;

      var myString = utils.sha1(credential);

      //console.log('myString: '+myString);

      var gkey = utils.gen256hexkey();

      content['user_salt'] = gkey;

      var str = utils.sha1(myString);

      var giv = str.substr(0, 32);

      var key = utils.CryptoJS.enc.Hex.parse(gkey);

      var iv =  utils.CryptoJS.enc.Hex.parse(giv);

      var ct = utils.CryptoJS.AES.encrypt(myString, key, { iv: iv });

      var encrypted = ct.ciphertext.toString(utils.CryptoJS.enc.Base64);

      content['user_hash'] = encrypted;

      var res = await db.Insert('tbl_user', content, 'user_id', (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
        obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
        return;
      });

      var json = {
        id: await utils.genId(),
        mobile: data.mobilenumber,
        //message: 'Pass Code: '+tempPass,
        message: tempPass+' is your temporary ecpMessenger password. ',
        timestamp: moment().format('x'),
      };

      localRedis.lpush('gmspromotexterqueue', JSON.stringify(json), redis.print);

      //localRedis.lpush('outbox', JSON.stringify(json), redis.print);

      var retdata = {success:1, register: 1}

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
