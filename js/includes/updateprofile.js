
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

      var sessionData = await new Promise((resolve, reject) => {
        localRedis.hget('ecpsessions','SID'+data.session, function(err, sessionData){
          if(err) {
            resolve(false);
          } else {
            try {
              var s = JSON.parse(sessionData);
              resolve(s);
            } catch(e) {
              resolve(false);
            }
          }
          //console.log(err);
          //console.log(sessionData);
        })
      });

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

      var content = {};
      content['user_lastname'] = data.lastname;
      content['user_firstname'] = data.firstname;
      content['user_middlename'] = data.middlename;
      content['user_gender'] = data.gender;

      var res = await db.Update('tbl_user', content, 'user_id='+sessionData.user_id, (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
        obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
        return;
      });

      var userinfo = await utils.getUserAccountByLogin(sessionData.user_login);

      if(!userinfo) {
        obj.response.json(utils.Encrypt({error_code:90023, error_message:'An error has occured.'}, decrypted.data.pkey));
        return;
      }

      delete userinfo.user_salt;
      delete userinfo.user_hash;

      //var fullname = [];

      //if(userinfo.user_firstname) {
        //fullname.push(userinfo.user_firstname);
      //}

      //if(userinfo.user_middlename) {
        //fullname.push(userinfo.user_middlename);
      //}

      //if(userinfo.user_lastname) {
        //fullname.push(userinfo.user_lastname);
      //}

      //userinfo.fullname = fullname.join(' ');
      userinfo.photo = userinfo.user_id+'.jpg';

      content = {}
      content['message_fruserid'] = sessionData.user_id;
      content['message_fruserlogin'] = sessionData.user_login;
      content['message_fruserfullname'] = userinfo.fullname;
      content['message_fruserfirstname'] = userinfo.user_firstname;
      content['message_frusermiddlename'] = userinfo.user_middlename;
      content['message_fruserlastname'] = userinfo.user_lastname;

      var updateSessionData = {
        id: sessionData.id,
        user_id: userinfo.user_id,
        user_login: userinfo.user_login,
        user_type: userinfo.user_type,
        userinfo: userinfo
      }

      localRedis.hset('ecpsessions', 'SID'+sessionData.id, JSON.stringify(updateSessionData), redis.print)

      var res = await db.Update('tbl_message', content, 'message_fruserid='+sessionData.user_id, (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
        obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
        return;
      });

      var retdata = {success:1, update: 1, userinfo: userinfo}

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
