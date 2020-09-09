
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

      if(userAccount.user_buyloadstatus) {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:"Your eLoader account is ALREADY activated."}, decrypted.data.pkey));
        return;
      }

      var connectionId = false;

      if(data.uid) {
        connectionId = data.uid;
      }

      try {

        var totalAmount = await utils.getOption('$SETTINGS_ELOADACTIVATIONMINIMUMPOINTS', 1000);
        var adminCharge = await utils.getOption('$SETTINGS_ELOADACTIVATIONSELFADMINCHARGE', 200);
        var serviceCharge = await utils.getOption('$SETTINGS_ELOADACTIVATIONSELFSERVICECHARGE', 300);

        var serviceChargeAccount = await utils.getServiceChargeAccount();
        var adminChargeAccount = await utils.getAdminChargeAccount();

        var topUp = parseFloat(totalAmount);

        if(parseFloat(adminCharge)>0) {
          topUp = topUp - parseFloat(adminCharge);
        }

        if(parseFloat(serviceCharge)>0) {
          topUp = topUp - parseFloat(serviceCharge);
        }

        var dbClient = await db.Connect();

        await db.Query('BEGIN', null, null, dbClient);
        await db.Query('LOCK TABLE tbl_transaction IN EXCLUSIVE MODE', null, null, dbClient);

        var content = {};
        content['transaction_userid'] = sessionData.user_id;
        content['transaction_userlogin'] = sessionData.user_login;
        content['transaction_usertype']  = sessionData.user_type;
        content['transaction_amount']  = totalAmount * -1;
        content['transaction_type']  = 'debit_points_activation_eloader';
        content['transaction_activatedeloaderuserid'] = userAccount.user_id;
        content['transaction_activatedeloaderuserlogin'] = userAccount.user_login;
        content['transaction_activatedeloaderusertype'] = userAccount.user_type;
        content['transaction_activatedeloaderfullname'] = userAccount.fullname;
        content['transaction_fundtouserid'] = userAccount.user_id;
        content['transaction_fundtouserlogin'] = userAccount.user_login;
        content['transaction_fundtousertype'] = userAccount.user_type;
        content['transaction_fundtofullname'] = userAccount.fullname;

        var res = await db.Insert('tbl_transaction', content, 'transaction_userbal', (client, result) => {
          //client.release();
          //console.log(result);
        }, (error) => {
          db.Query('ROLLBACK', null, null, dbClient);
          console.log('ERROR!');
          console.log(error);
          obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          return;
        }, dbClient);

        var myUserBal = 0;

        try {
          myUserBal = res.rows[0].transaction_userbal;
        } catch(e) {
          console.log(e);
        }

        if(myUserBal<0) {
          await db.Query('ROLLBACK', null, null, dbClient);
          dbClient.release();
          obj.response.json(utils.Encrypt({error_code:90030, error_message:'Insufficient fund.'}, decrypted.data.pkey));
          return;
        }

        if(parseFloat(serviceCharge)>0) {

          var content = {};
          content['transaction_userid'] = serviceChargeAccount.user_id;
          content['transaction_userlogin'] = serviceChargeAccount.user_login;
          content['transaction_usertype']  = serviceChargeAccount.user_type;
          content['transaction_amount']  = serviceCharge;
          content['transaction_type']  = 'credit_points_servicecharge';
          content['transaction_activatedeloaderuserid'] = userAccount.user_id;
          content['transaction_activatedeloaderuserlogin'] = userAccount.user_login;
          content['transaction_activatedeloaderusertype'] = userAccount.user_type;
          content['transaction_activatedeloaderfullname'] = userAccount.fullname;
          content['transaction_fundfromuserid'] = userAccount.user_id;
          content['transaction_fundfromuserlogin'] = userAccount.user_login;
          content['transaction_fundfromusertype'] = userAccount.user_type;
          content['transaction_fundfromfullname'] = userAccount.fullname;

          var res = await db.Insert('tbl_transaction', content, 'transaction_userbal', (client, result) => {
            //client.release();
            //console.log(result);
          }, (error) => {
            db.Query('ROLLBACK', null, null, dbClient);
            console.log('ERROR!');
            console.log(error);
            obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
            return;
          }, dbClient);
        }

        if(parseFloat(adminCharge)>0) {

          var content = {};
          content['transaction_userid'] = adminChargeAccount.user_id;
          content['transaction_userlogin'] = adminChargeAccount.user_login;
          content['transaction_usertype']  = adminChargeAccount.user_type;
          content['transaction_amount']  = adminCharge;
          content['transaction_type']  = 'credit_points_admincharge';
          content['transaction_activatedeloaderuserid'] = userAccount.user_id;
          content['transaction_activatedeloaderuserlogin'] = userAccount.user_login;
          content['transaction_activatedeloaderusertype'] = userAccount.user_type;
          content['transaction_activatedeloaderfullname'] = userAccount.fullname;
          content['transaction_fundfromuserid'] = userAccount.user_id;
          content['transaction_fundfromuserlogin'] = userAccount.user_login;
          content['transaction_fundfromusertype'] = userAccount.user_type;
          content['transaction_fundfromfullname'] = userAccount.fullname;

          var res = await db.Insert('tbl_transaction', content, 'transaction_userbal', (client, result) => {
            //client.release();
            //console.log(result);
          }, (error) => {
            db.Query('ROLLBACK', null, null, dbClient);
            console.log('ERROR!');
            console.log(error);
            obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
            return;
          }, dbClient);
        }

        if(parseFloat(topUp)>0) {

          var content = {};
          content['transaction_userid'] = userAccount.user_id;
          content['transaction_userlogin'] = userAccount.user_login;
          content['transaction_usertype']  = userAccount.user_type;
          content['transaction_amount']  = topUp;
          content['transaction_type']  = 'credit_points';
          content['transaction_fundfromuserid'] = sessionData.user_id;
          content['transaction_fundfromuserlogin'] = sessionData.user_login;
          content['transaction_fundfromusertype'] = sessionData.user_type;
          content['transaction_fundfromfullname'] = sessionData.userinfo.fullname;

          //content['transaction_activatedeloaderuserid'] = userAccount.user_id;
          //content['transaction_activatedeloaderuserlogin'] = userAccount.user_login;
          //content['transaction_activatedeloaderusertype'] = userAccount.user_type;
          //content['transaction_activatedeloaderfullname'] = userAccount.fullname;

          var res = await db.Insert('tbl_transaction', content, 'transaction_userbal', (client, result) => {
            //client.release();
            //console.log(result);
          }, (error) => {
            db.Query('ROLLBACK', null, null, dbClient);
            console.log('ERROR!');
            console.log(error);
            obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
            return;
          }, dbClient);

          var yourUserBal = 0;

          try {
            yourUserBal = res.rows[0].transaction_userbal;
          } catch(e) {
            console.log(e);
          }

        }

        var content = {};
        content['user_buyloadactivatedstamp'] = 'now()';
        content['user_buyloadstatus'] = 1;
        content['user_buyloadactivatedbyuserid'] = sessionData.user_id;
        content['user_buyloadactivatedbyuserlogin'] = sessionData.user_login;
        content['user_buyloadactivatedbyusertype'] = sessionData.userinfo.user_type;
        content['user_buyloadactivatedbyfullname'] = sessionData.userinfo.fullname;

        var res = await db.Update('tbl_user', content, "user_id='"+userAccount.user_id+"'", (client, result) => {
          //client.release();
          //console.log(result);
        }, (error) => {
          db.Query('ROLLBACK', null, null, dbClient);
          console.log('ERROR!');
          console.log(error);
          obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          return;
        }, dbClient);

        await db.Query('COMMIT', null, null, dbClient);
        dbClient.release();

        if(connectionId) {
          obj.connections[connectionId].sendUTF(JSON.stringify({ type: 'points', balance: myUserBal, timestamp: utils.unixStamp()} ));
        }

        for(var x in obj.connections) {
          if(obj.connections[x]&&obj.connections[x].user_id&&obj.connections[x].user_id==userAccount.user_id) {
            obj.connections[x].sendUTF(JSON.stringify({ type: 'points', balance: yourUserBal, timestamp: utils.unixStamp()} ));
          }

          //if(obj.connections[x]&&obj.connections[x].userData&&obj.connections[x].userData.id&&obj.connections[x].userData.id==destData.user_id) {
            //obj.connections[x].sendUTF(JSON.stringify({ type: 'points', balance: yourUserBal, timestamp: utils.unixStamp()} ));
          //}
        }

      } catch(e) {
        db.Query('ROLLBACK', null, null, dbClient);
        dbClient.release();
        console.log(e);
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'An error has occured.'}, decrypted.data.pkey));
        return;
      }

      var userinfo = await utils.getUserAccountByLogin(sessionData.user_login);

      delete userinfo.user_salt;
      delete userinfo.user_hash;

      userinfo.photo = userinfo.user_id+'.jpg';

      var retdata = {success:1, userinfo:userinfo}

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
