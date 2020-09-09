
const nconf = require('nconf');
const moment = require('moment');
const redis = require('redis');
const uuid4 = require('uuid4');
const numeral = require('numeral');
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

      console.log({sessionData: sessionData});

      if(!data.startdate) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid session.'}, decrypted.data.pkey));
        return;
      }

      if(!data.enddate) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid session.'}, decrypted.data.pkey));
        return;
      }

      var startstamp;
      var endstamp;

      try {
        startstamp = parseFloat(moment(data.startdate+' 00:00:00', "YYYY-MM-DD HH:mm:ss").format('X'));
        endstamp = parseFloat(moment(data.enddate+' 23:59:59', "YYYY-MM-DD HH:mm:ss").format('X'));
      } catch(e) {
        console.log(e);
      }

      if(startstamp&&endstamp) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid date range.'}, decrypted.data.pkey));
        return;
      }

      console.log({startstamp: startstamp, endstamp: endstamp});

      var sql;

      if(data.status) {
        sql = "SELECT *, extract(epoch from buyload_createstamp) as createstamp FROM tbl_buyload WHERE buyload_userlogin='"+sessionData.user_login+"' AND buyload_status='"+data.status+"' AND extract(epoch from buyload_createstamp)>="+startstamp+" AND extract(epoch from buyload_createstamp)<="+endstamp+" ORDER BY buyload_id ASC";
      } else {
        sql = "SELECT *, extract(epoch from buyload_createstamp) as createstamp FROM tbl_buyload WHERE buyload_userlogin='"+sessionData.user_login+"' AND extract(epoch from buyload_createstamp)>="+startstamp+" AND extract(epoch from buyload_createstamp)<="+endstamp+" ORDER BY buyload_id ASC";
      }

      console.log(sql);

      var res = await db.Query(sql, (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
      });

      //var row;
      //var history = [];

      //console.log({res: res});

      // getEloadProduct

      if(res&&res.rows&&res.rows.length) {

        for(var x in res.rows) {
          res.rows[x].createdate = moment((res.rows[x].createstamp*1000)).format("ddd Do MMM YYYY, h:mm:ssa");

          var balance = res.rows[x].buyload_userbalance;

          try {
            var bal = numeral(balance).format('0,0.00')
          } catch(e) {
            var bal = peso;
          }

          res.rows[x].balance = bal;

          var product = await utils.getEloadProduct(res.rows[x].buyload_pcode, res.rows[x].buyload_provider);

          for(var y in product) {
            res.rows[x][y] = product[y];
          }
          //res.rows[x].product = await utils.getEloadProduct(res.rows[x].buyload_pcode, res.rows[x].buyload_provider);
        }

        console.log(res.rows);

        var retdata = {success:1, transactions: res.rows}

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
