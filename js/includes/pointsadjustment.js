
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

      if(sessionData.user_type=='ADM') {
      } else {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid session.'}, decrypted.data.pkey));
        return;
      }

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

      if(!utils.isValidMobileNumber(data.srcmobilenumber)) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid source mobile number.'}, decrypted.data.pkey));
        return;
      }

      var srcData = await utils.getUserAccountByLogin(data.srcmobilenumber);

      if(!srcData) {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid account number. Cannot do adjustment.'}, decrypted.data.pkey));
        return;
      }

      if(!utils.isValidMobileNumber(data.destmobilenumber)) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid destination mobile number.'}, decrypted.data.pkey));
        return;
      }

      var destData = await utils.getUserAccountByLogin(data.destmobilenumber);

      if(!destData) {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Invalid account number. Cannot do adjustment.'}, decrypted.data.pkey));
        return;
      }

      try {

        //var pointsTransferServiceCharge = await utils.getOption('$SETTINGS_POINTSTRANSFERSERVICECHARGE', 0);
        //var adminCharge = await utils.getOption('$SETTINGS_ADMINCHARGE', 0);
        //var serviceChargeAccount = await utils.getServiceChargeAccount();
        //var adminChargeAccount = await utils.getAdminChargeAccount();

        //if(parseFloat(pointsTransferServiceCharge)>0) {
        //  pointsTransferServiceCharge = parseFloat(pointsTransferServiceCharge);
        //} else {
        //  pointsTransferServiceCharge = 0;
        //}

        //if(parseFloat(adminCharge)>0) {
        //  adminCharge = parseFloat(adminCharge);
        //} else {
        //  adminCharge = 0;
        //}

        //if(sessionData.user_type=='CASHIER') {
        //  pointsTransferServiceCharge = 0;
        //  adminCharge = 0;
        //}

        var fullname;
        var dbClient = await db.Connect();

        await db.Query('BEGIN', null, null, dbClient);
        await db.Query('LOCK TABLE tbl_transaction IN EXCLUSIVE MODE', null, null, dbClient);

        destfullname = [];
        srcfullname = [];

        if(destData.user_firstname) {
          destfullname.push(destData.user_firstname);
        }

        if(destData.user_middlename) {
          destfullname.push(destData.user_middlename);
        }

        if(destData.user_lastname) {
          destfullname.push(destData.user_lastname);
        }

        if(srcData.user_firstname) {
          srcfullname.push(srcData.user_firstname);
        }

        if(srcData.user_middlename) {
          srcfullname.push(srcData.user_middlename);
        }

        if(srcData.user_lastname) {
          srcfullname.push(srcData.user_lastname);
        }

        var content = {};
        content['transaction_userid'] = srcData.user_id;
        content['transaction_userlogin'] = srcData.user_login;
        content['transaction_usertype']  = srcData.user_type;
        content['transaction_amount']  = totalAmount * -1;
        content['transaction_type']  = 'debit_points';
        content['transaction_fundtouserid'] = destData.user_id;
        content['transaction_fundtouserlogin'] = destData.user_login;
        content['transaction_fundtousertype'] = destData.user_type;
        content['transaction_fundtofullname'] = destfullname.join(' ');

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

        var content = {};
        content['transaction_userid'] = destData.user_id;
        content['transaction_userlogin'] = destData.user_login;
        content['transaction_usertype']  = destData.user_type;
        content['transaction_amount']  = totalAmount;
        content['transaction_type']  = 'credit_points';
        content['transaction_fundfromuserid'] = srcData.user_id;
        content['transaction_fundfromuserlogin'] = srcData.user_login;
        content['transaction_fundfromusertype'] = srcData.user_type;
        content['transaction_fundfromfullname'] = srcfullname.join(' ');

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

        await db.Query('COMMIT', null, null, dbClient);

        dbClient.release();

        var curdate = utils.Moment().format("MMM D YYYY h:mma");

        try {
          var mbal = numeral(myUserBal).format('0.00')
        } catch(e) {
          var mbal = myUserBal;
          console.log(e);
        }

        try {
          var ubal = numeral(yourUserBal).format('0.00')
        } catch(e) {
          var ubal = yourUserBal;
          console.log(e);
        }

        var msg = "Adjustment P"+totalAmount+" from "+srcData.user_login+"(P"+mbal+") to "+destData.user_login+"(P"+ubal+"). "+curdate+" Tx:"+tranId;

        var json = {
          id: await utils.genId(),
          mobile: sessionData.user_login,
          message: msg,
          senderid: 'ecpMessenger',
          timestamp: moment().format('x'),
        };

        localRedis.lpush('ecpinfobox', JSON.stringify(json), redis.print);

        var msg = "The amount of P"+totalAmount+" has been deducted from your account due to adjustment. "+curdate+" Bal:P"+mbal+" Tx:"+tranId;

        var json = {
          id: await utils.genId(),
          mobile: srcData.user_login,
          message: msg,
          senderid: 'ecpMessenger',
          timestamp: moment().format('x'),
        };

        //localRedis.lpush('outbox', JSON.stringify(json), redis.print);

        localRedis.lpush('ecpinfobox', JSON.stringify(json), redis.print);


        msg = "The amount of P"+totalAmount+" has been credited to your account due to adjustment. "+curdate+" Bal:P"+ubal+" Tx:"+tranId;

        var json = {
          id: await utils.genId(),
          mobile: destData.user_login,
          message: msg,
          senderid: 'ecpMessenger',
          timestamp: moment().format('x'),
        };

        localRedis.lpush('ecpinfobox', JSON.stringify(json), redis.print);

      } catch(e) {
        db.Query('ROLLBACK', null, null, dbClient);
        dbClient.release();
        console.log(e);
      }

      //if(connectionId) {
      //  obj.connections[connectionId].sendUTF(JSON.stringify({ type: 'points', balance: myUserBal, timestamp: utils.unixStamp()} ));
      //}

      var bjson = {
        type: 'points',
        userid: destData.user_id,
        balance: yourUserBal,
        timestamp: utils.unixStamp()
      }

      localRedis.lpush('ecpupdatebalance', JSON.stringify(bjson), redis.print);

      var bjson = {
        type: 'points',
        userid: srcData.user_id,
        balance: myUserBal,
        timestamp: utils.unixStamp()
      }

      localRedis.lpush('ecpupdatebalance', JSON.stringify(bjson), redis.print);

      //try {
      //  for(var x in obj.connections) {
      //    if(obj.connections[x]&&obj.connections[x].user_id&&obj.connections[x].user_id==destData.user_id) {
      //      obj.connections[x].sendUTF(JSON.stringify({ type: 'points', balance: yourUserBal, timestamp: utils.unixStamp()} ));
      //    }

      //    if(obj.connections[x]&&obj.connections[x].user_id&&obj.connections[x].user_id==srcData.user_id) {
      //      obj.connections[x].sendUTF(JSON.stringify({ type: 'points', balance: myUserBal, timestamp: utils.unixStamp()} ));
      //    }
      //  }
      //} catch(e) {
      //  console.log(e);
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
