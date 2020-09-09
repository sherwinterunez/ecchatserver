
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

      /*var sessionData = await new Promise((resolve, reject) => {
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
      });*/

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

      const sql = "SELECT * FROM tbl_transaction WHERE transaction_userlogin='"+sessionData.user_login+"' ORDER BY transaction_id DESC LIMIT 20";

      console.log(sql);

      var res = await db.Query(sql, (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
      });

      var row;
      var history = [];

      if(res&&res.rows) {

        console.log(res.rows);

        for(var x in res.rows) {
          var desc;

          if(res.rows[x].transaction_type=='buyload_charge') {
            desc = 'Buy Load';
          } else
          if(res.rows[x].transaction_type=='buyload_cashier') {
            desc = 'BuyLoad Transaction';
          } else
          if(res.rows[x].transaction_type=='buyload_admincharge') {
            desc = 'BuyLoad AdminCharge';
          } else
          if(res.rows[x].transaction_type=='buyload_cashier_refund') {
            desc = 'BuyLoad Refund';
          } else
          if(res.rows[x].transaction_type=='buyload_charge_refund') {
            desc = 'BuyLoad Reversed';
          } else
          if(res.rows[x].transaction_type=='buyload_admincharge_refund') {
            desc = 'BuyLoad Admin Refund';
          } else
          if(res.rows[x].transaction_type=='debit_points_activation_eloader') {
            desc = 'eLoader Activation Charge';
          } else
          if(res.rows[x].transaction_type=='credit_points_admincharge') {
            desc = 'Credit Admin Charge';
          } else
          if(res.rows[x].transaction_type=='debit_points_servicecharge') {
            desc = 'Service Charge';
          } else
          if(res.rows[x].transaction_type=='credit_points_servicecharge') {
            desc = 'Credit Service Charge';
          } else
          if(res.rows[x].transaction_type=='credit_points_payment') {
            desc = 'Credit Payment Charge';
          } else
          if(res.rows[x].transaction_type=='debit_points_payment') {
            desc = 'Payment Charge';
          } else
          if(res.rows[x].transaction_type=='debit_points') {
            desc = 'Debit Points';
          } else
          if(res.rows[x].transaction_type=='credit_points') {
            desc = 'Credit Points';
          } else
          if(res.rows[x].transaction_type=='system_credit') {
            desc = 'System Credit';
          } else {
            desc = 'Unknown';
          }

          var t = res.rows[x].transaction_id.toString();
          var unix = parseInt(t.substr(0,10));

          var amount = parseFloat(res.rows[x].transaction_amount).toLocaleString(undefined, {maximumFractionDigits:2});

          if(res.rows[x].transaction_amount>0) {
            amount = '+' + amount;
          }

          var row = {
            id: res.rows[x].transaction_id,
            desc: desc,
            amount: amount,
            unix: unix,
            type: res.rows[x].transaction_type,
            date: moment(unix*1000).format("ddd, MMM Do YYYY, h:mma"),
            fundtouserlogin: res.rows[x].transaction_fundtouserlogin,
            fundtousertype: res.rows[x].transaction_fundtousertype,
            fundtofullname: res.rows[x].transaction_fundtofullname,
            fundfromuserlogin: res.rows[x].transaction_fundfromuserlogin,
            fundfromusertype: res.rows[x].transaction_fundfromusertype,
            fundfromfullname: res.rows[x].transaction_fundfromfullname,
            loadmobileno: res.rows[x].transaction_loadmobileno,
            loadpcode: res.rows[x].transaction_loadpcode,
            loadrefno: res.rows[x].transaction_loadrefno,
          };

          history.push(row);
        }

        var retdata = {success:1, transactions: history}

        //console.log(retdata);

        var ret = utils.Encrypt(retdata, decrypted.data.pkey);

        obj.response.json(ret);

        return;

      } else {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'No transactions found.'}, decrypted.data.pkey));
        return;
      }
    }

  } catch(e) {
    console.log(e);
  }

  obj.response.json({error_code:90020, error_message:'Invalid operation.'});
}

exports.myFunc = myfunc;
