
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

      if(!data.type) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      if(!data.fbid) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      if(!data.pcode) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      if(!data.network) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      if(!data.receiverno) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      if(!utils.isValidMobileNumber(data.receiverno)) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid receiver number.'}, decrypted.data.pkey));
        return;
      }

      //obj.response.json(utils.Encrypt({error_code:90021, error_message:'Success.'}, decrypted.data.pkey));
      //return;

      var pcode = data.pcode;

      var network = utils.checkNetwork(data.receiverno);

      if(!network) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid receiver number.'}, decrypted.data.pkey));
        return;
      }

      var userAccount = await utils.getUserAccountByFbId(data.fbid);

      if(userAccount) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90022, error_message:'Access denied.'}, decrypted.data.pkey));
        return;
      }

      var product = await utils.getEloadProduct(pcode, network);

      if(product&&product.eloadproduct_amount&&product.eloadproduct_pcode&&product.eloadproduct_subcarrier) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90023, error_message:'Invalid product.'}, decrypted.data.pkey));
        return;
      }

      var connectionId = false;

      if(data.uid) {
        connectionId = data.uid;
      }

      var mobilenumber = data.receiverno;

      var adminCharge = true;

      var buyLoadAdminChargePercentage = await utils.getOption('$SETTINGS_BUYLOADADMINCHARGEPERCENTAGE', 0.0025);

      var buyLoadRebatePercentage = await utils.getOption('$SETTINGS_BUYLOADREBATEPERCENTAGE', 0.0125);

      var adminChargeAccount = await utils.getAdminChargeAccount();

      var cashierAccount = await utils.getCashierAccount();

      buyLoadRebatePercentage = 1 - parseFloat(buyLoadRebatePercentage);

      var origAmount = parseFloat(product.eloadproduct_amount);

      var amount = origAmount * buyLoadRebatePercentage;

      var adminChargeAmount = parseFloat(product.eloadproduct_amount) * parseFloat(buyLoadAdminChargePercentage);

      if(adminCharge) {
        amount = amount - adminChargeAmount;
      }

      var cashierAmount = amount - adminChargeAmount;

      var transaction_desc = pcode + ' LOAD ' + origAmount + ' TO ' + mobilenumber;

      var dbClient = await db.Connect();

      await db.Query('BEGIN', null, null, dbClient);
      await db.Query('LOCK TABLE tbl_transaction IN EXCLUSIVE MODE', null, null, dbClient);

      var content = {};
      content['transaction_userid'] = userAccount.user_id;
      content['transaction_userlogin'] = userAccount.user_login;
      content['transaction_usertype']  = userAccount.user_type;
      content['transaction_amount']  = amount * -1;
      content['transaction_type']  = 'buyload_charge';
      content['transaction_desc'] = transaction_desc;
      content['transaction_loadmobileno'] = mobilenumber;
      content['transaction_loadpcode'] = pcode;
      content['transaction_loadnetwork'] = network;

      var res = await db.Insert('tbl_transaction', content, 'transaction_id, transaction_userbal', (client, result) => {
        //client.release();
        //console.log(result);
      }, (error) => {
        db.Query('ROLLBACK', null, null, dbClient);
        //dbClient.release();
        console.log('ERROR!');
        console.log(error);
        obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
        return;
      }, dbClient);

      if(!res) {
        return;
      }

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
        //dbClient.release();
        obj.response.json(utils.Encrypt({error_code:90030, error_message:'Insufficient fund.', myUserBal:myUserBal, tranId:tranId}, decrypted.data.pkey));
        return;
      }

      var content = {};
      content['transaction_userid'] = cashierAccount.user_id;
      content['transaction_userlogin'] = cashierAccount.user_login;
      content['transaction_usertype']  = cashierAccount.user_type;
      content['transaction_amount']  = cashierAmount;
      content['transaction_type']  = 'buyload_cashier';
      content['transaction_desc'] = transaction_desc;
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

      if(!res) {
        return;
      }

      if(adminCharge) {
        // adminChargeAccount

        var content = {};
        content['transaction_userid'] = adminChargeAccount.user_id;
        content['transaction_userlogin'] = adminChargeAccount.user_login;
        content['transaction_usertype']  = adminChargeAccount.user_type;
        content['transaction_amount']  = adminChargeAmount;
        content['transaction_type']  = 'buyload_admincharge';
        content['transaction_desc'] = transaction_desc;
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

        if(!res) {
          return;
        }
      }

      var content = {};
  		content['buyload_receiverno'] = mobilenumber;
  		content['buyload_pcode'] = pcode;
  		content['buyload_provider'] = network;
  		content['buyload_amount'] = amount;
  		content['buyload_origamount'] = origAmount;
  		content['buyload_userid'] = userAccount.user_id;
  		content['buyload_userlogin'] = userAccount.user_login;
  		content['buyload_usertype'] = userAccount.user_type;
      content['buyload_transid'] = tranId;
      content['buyload_userbalance'] = myUserBal;
      content['buyload_status'] = 'NEW';

      if(adminCharge) {
        content['buyload_admincharge'] = adminChargeAmount;
      }

      var bcontent = content;

      var res = await db.Insert('tbl_buyload', content, 'buyload_id', (client, result) => {
        //client.release();
        //console.log(result);
      }, (error) => {
        db.Query('ROLLBACK', null, null, dbClient);
        //dbClient.release();
        console.log('ERROR!');
        console.log(error);
        obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
        return;
      }, dbClient);

      if(!res) {
        return;
      }

      var buyLoadId = 0;

      try {
        buyLoadId = res.rows[0].buyload_id;
      } catch(e) {
        console.log(e);
      }

      await db.Query('COMMIT', null, null, dbClient);

      if(buyLoadId) {

        bcontent['buyload_id'] = buyLoadId;

        var ucontent = [];
        ucontent['buyload_cgnid'] = 'ECP'+buyLoadId;
        ucontent['buyload_updatestamp'] = 'now()';

        if(connectionId) {
          ucontent['buyload_connectionid'] = connectionId;
          bcontent['buyload_connectionid'] = connectionId;
        }

        console.log({ucontent: ucontent});

        var res = await db.Update('tbl_buyload', ucontent, "buyload_id="+buyLoadId, (client, result) => {
          //client.release();
          //console.log(result);
        }, (error) => {
          //db.Query('ROLLBACK', null, null, dbClient);
          //dbClient.release();
          console.log('ERROR!');
          console.log(error);
          obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          return;
        }, dbClient);

        if(!res) {
          return;
        }

        console.log({bcontent: bcontent});

        localRedis.lpush('ecpbuyloadqueue', JSON.stringify(bcontent), redis.print);
      }

      try {
        dbClient.release();
      } catch(e) {
        console.log(e);
      }

      if(connectionId) {
        obj.connections[connectionId].sendUTF(JSON.stringify({ type: 'points', balance: myUserBal, timestamp: utils.unixStamp()} ));
      }

      var retdata = {success:1, product: product, amount: amount, adminCharge: adminCharge, network: network}

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
