
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

      if(data.amount&&parseFloat(data.amount)>0) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid amount.'}, decrypted.data.pkey));
        return;
      }

      var connectionId = false;

      if(data.uid) {
        connectionId = data.uid;
      }

      var totalAmount = parseFloat(data.amount);

      if(!utils.isValidMobileNumber(data.mobilenumber)) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid mobile number.'}, decrypted.data.pkey));
        return;
      }

      var destData = await utils.getUserAccountByLogin(data.mobilenumber);

      if(!destData) {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid account number. Cannot transfer points.'}, decrypted.data.pkey));
        return;
      }

      try {

        var pointsTransferServiceCharge = await utils.getOption('$SETTINGS_POINTSTRANSFERSERVICECHARGE', 0);
        var adminCharge = await utils.getOption('$SETTINGS_ADMINCHARGE', 0);
        var serviceChargeAccount = await utils.getServiceChargeAccount();
        var adminChargeAccount = await utils.getAdminChargeAccount();

        if(parseFloat(pointsTransferServiceCharge)>0) {
          pointsTransferServiceCharge = parseFloat(pointsTransferServiceCharge);
        } else {
          pointsTransferServiceCharge = 0;
        }

        if(parseFloat(adminCharge)>0) {
          adminCharge = parseFloat(adminCharge);
        } else {
          adminCharge = 0;
        }

        if(sessionData.user_type=='CASHIER') {
          pointsTransferServiceCharge = 0;
          adminCharge = 0;
        }

        var fullname;
        var dbClient = await db.Connect();

        await db.Query('BEGIN', null, null, dbClient);
        await db.Query('LOCK TABLE tbl_transaction IN EXCLUSIVE MODE', null, null, dbClient);

        fullname = [];

        if(destData.user_firstname) {
          fullname.push(destData.user_firstname);
        }

        if(destData.user_middlename) {
          fullname.push(destData.user_middlename);
        }

        if(destData.user_lastname) {
          fullname.push(destData.user_lastname);
        }

        var content = {};
        content['transaction_userid'] = sessionData.user_id;
        content['transaction_userlogin'] = sessionData.user_login;
        content['transaction_usertype']  = sessionData.user_type;
        content['transaction_amount']  = totalAmount * -1;
        content['transaction_type']  = 'debit_points';
        content['transaction_fundtouserid'] = destData.user_id;
        content['transaction_fundtouserlogin'] = destData.user_login;
        content['transaction_fundtousertype'] = destData.user_type;
        content['transaction_fundtofullname'] = fullname.join(' ');

        var res = await db.Insert('tbl_transaction', content, 'transaction_id, transaction_userbal', (client, result) => {
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
        var tranId = 0;

        try {
          myUserBal = res.rows[0].transaction_userbal;
          tranId = res.rows[0].transaction_id;
        } catch(e) {
          console.log(e);
        }

        if(myUserBal<0) {
          await db.Query('ROLLBACK', null, null, dbClient);
          dbClient.release();
          obj.response.json(utils.Encrypt({error_code:90030, error_message:'Insufficient fund.'}, decrypted.data.pkey));
          return;
        }

        if(pointsTransferServiceCharge) {
          content['transaction_amount']  = pointsTransferServiceCharge * -1;
          content['transaction_type']  = 'debit_points_servicecharge';

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
        }

        fullname = [];

        if(sessionData.userinfo.user_firstname) {
          fullname.push(sessionData.userinfo.user_firstname);
        }

        if(sessionData.userinfo.user_middlename) {
          fullname.push(sessionData.userinfo.user_middlename);
        }

        if(sessionData.userinfo.user_lastname) {
          fullname.push(sessionData.userinfo.user_lastname);
        }

        var content = {};
        content['transaction_userid'] = destData.user_id;
        content['transaction_userlogin'] = destData.user_login;
        content['transaction_usertype']  = destData.user_type;
        content['transaction_amount']  = totalAmount;
        content['transaction_type']  = 'credit_points';
        content['transaction_fundfromuserid'] = sessionData.user_id;
        content['transaction_fundfromuserlogin'] = sessionData.user_login;
        content['transaction_fundfromusertype'] = sessionData.user_type;
        content['transaction_fundfromfullname'] = fullname.join(' ');

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

        if(pointsTransferServiceCharge) {
          //serviceChargeAccount

          if(pointsTransferServiceCharge&&adminCharge) {
            pointsTransferServiceCharge = pointsTransferServiceCharge - adminCharge;
          }

          var content = {};
          content['transaction_userid'] = serviceChargeAccount.user_id;
          content['transaction_userlogin'] = serviceChargeAccount.user_login;
          content['transaction_usertype']  = serviceChargeAccount.user_type;
          content['transaction_amount']  = pointsTransferServiceCharge;
          content['transaction_type']  = 'credit_points_servicecharge';
          content['transaction_fundfromuserid'] = sessionData.user_id;
          content['transaction_fundfromuserlogin'] = sessionData.user_login;
          content['transaction_fundfromusertype'] = sessionData.user_type;
          content['transaction_fundfromfullname'] = fullname.join(' ');

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

        if(adminCharge) {
          // adminChargeAccount

          var content = {};
          content['transaction_userid'] = adminChargeAccount.user_id;
          content['transaction_userlogin'] = adminChargeAccount.user_login;
          content['transaction_usertype']  = adminChargeAccount.user_type;
          content['transaction_amount']  = adminCharge;
          content['transaction_type']  = 'credit_points_admincharge';
          content['transaction_fundfromuserid'] = sessionData.user_id;
          content['transaction_fundfromuserlogin'] = sessionData.user_login;
          content['transaction_fundfromusertype'] = sessionData.user_type;
          content['transaction_fundfromfullname'] = fullname.join(' ');

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

        await db.Query('COMMIT', null, null, dbClient);

        dbClient.release();

        var curdate = utils.Moment().format("MMM D YYYY h:mma");

        try {
          var mbal = numeral(myUserBal).format('0.00')
        } catch(e) {
          var mbal = myUserBal;
          console.log(e);
        }

        var msg = "You have successfully transferred P"+totalAmount+" to "+destData.user_login+". "+curdate+" Bal:P"+mbal+" Tx:"+tranId;

        //var fcm = {
        //  key: FCM_SERVER_KEY,
          //topic: '/topics/'+FCM_DEFAULT_TOPIC+json.touserlogin,
        //  topic: FCM_DEFAULT_TOPIC+sessionData.user_login,
        //  title: 'ecpMessenger',
        //  body: msg,
        //}

        //console.log(fcm);

        //utils.sendFCM(fcm);

        var json = {
          id: await utils.genId(),
          mobile: sessionData.user_login,
          message: msg,
          senderid: 'ecpMessenger',
          timestamp: moment().format('x'),
        };

        //localRedis.lpush('outbox', JSON.stringify(json), redis.print);

        localRedis.lpush('ecpinfobox', JSON.stringify(json), redis.print);

        try {
          var ubal = numeral(yourUserBal).format('0.00')
        } catch(e) {
          var ubal = yourUserBal;
          console.log(e);
        }

        msg = "The amount of P"+totalAmount+" has been credited to your account. "+curdate+" Bal:P"+ubal+" Tx:"+tranId;

        //var fcm = {
        //  key: FCM_SERVER_KEY,
          //topic: '/topics/'+FCM_DEFAULT_TOPIC+json.touserlogin,
        //  topic: FCM_DEFAULT_TOPIC+destData.user_login,
        //  title: 'ecpMessenger',
        //  body: msg,
        //}

        //console.log(fcm);

        //utils.sendFCM(fcm);

        var json = {
          id: await utils.genId(),
          mobile: destData.user_login,
          message: msg,
          senderid: 'ecpMessenger',
          timestamp: moment().format('x'),
        };

        //localRedis.lpush('outbox', JSON.stringify(json), redis.print);

        localRedis.lpush('ecpinfobox', JSON.stringify(json), redis.print);

      } catch(e) {
        db.Query('ROLLBACK', null, null, dbClient);
        dbClient.release();
        console.log(e);
      }

      var bjson = {
        type: 'points',
        userid: sessionData.user_id,
        balance: myUserBal,
        timestamp: utils.unixStamp()
      }

      localRedis.lpush('ecpupdatebalance', JSON.stringify(bjson), redis.print);

      var bjson = {
        type: 'points',
        userid: destData.user_id,
        balance: yourUserBal,
        timestamp: utils.unixStamp()
      }

      localRedis.lpush('ecpupdatebalance', JSON.stringify(bjson), redis.print);

      //if(connectionId) {
      //  obj.connections[connectionId].sendUTF(JSON.stringify({ type: 'points', balance: myUserBal, timestamp: utils.unixStamp()} ));
      //}

      //for(var x in obj.connections) {
        //if(obj.connections[x]&&obj.connections[x].user_id&&obj.connections[x].user_id==destData.user_id) {
          //obj.connections[x].sendUTF(JSON.stringify({ type: 'points', balance: yourUserBal, timestamp: utils.unixStamp()} ));
        //}

        //if(obj.connections[x]&&obj.connections[x].userData&&obj.connections[x].userData.id&&obj.connections[x].userData.id==destData.user_id) {
          //obj.connections[x].sendUTF(JSON.stringify({ type: 'points', balance: yourUserBal, timestamp: utils.unixStamp()} ));
        //}
      //}

      var retdata = {success:1, register: 1}

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
