
const nconf = require('nconf');

const Utils = require('../utils.js');
const Database = require('../db.js');

var myfunc = async function(obj) {

  var db = new Database(obj.pool);

  var utils = new Utils();

  try {

    var decrypted = utils.Decrypt(obj.request);

    console.log({decrypted:decrypted});

    if(decrypted.data) {

      var data = decrypted.data;

      if(data.username&&data.hash) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90025, error_message:'Invalid data.'}, decrypted.data.pkey));
        return;
      }

      const sql = "SELECT * FROM tbl_user WHERE user_login='"+data.username+"'";

      console.log(sql);

      var res = await db.Query(sql, (client, result) => {
        client.release();
        //console.log(result);
      }, (error) => {
        console.log('ERROR!');
        console.log(error);
      });

      console.log(res);

      if(res&&res.rowCount) {
      } else {
        obj.response.json(utils.Encrypt({error_code:90023, error_message:'Invalid username.'}, decrypted.data.pkey));
        return;
      }

      var userinfo = res.rows[0];

      var user_id = userinfo.user_id;

      var user_hash = userinfo.user_hash;

      var gkey = userinfo.user_salt;

      var str = utils.sha1(data.hash);

      var giv = str.substr(0, 32);

      var key = utils.CryptoJS.enc.Hex.parse(gkey);

      var iv =  utils.CryptoJS.enc.Hex.parse(giv);

      var ct = utils.CryptoJS.AES.encrypt(data.hash, key, { iv: iv });

      var encrypted = ct.ciphertext.toString(utils.CryptoJS.enc.Base64);

      console.log('user_hash: '+user_hash);
      console.log('encrypted: '+encrypted);

      if(encrypted) {

        delete userinfo.user_salt;
        delete userinfo.user_hash;
        delete userinfo.user_temppass;

        var retdata = {success:1, changepass: 1, userinfo: userinfo}

        console.log(retdata);

        var ret = utils.Encrypt(retdata, decrypted.data.pkey);

        obj.response.json(ret);

        var content = [];
        content['user_loginstamp'] = 'now()';
        content['user_hash'] = encrypted;
        content['user_temppass'] = '0';

        var res = await db.Update('tbl_user', content, "user_id='"+user_id+"'", (client, result) => {
          client.release();
          console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
        });

        return;
      }

      obj.response.json(utils.Encrypt({error_code:90024, error_message:'Invalid username/password.'}, decrypted.data.pkey));
      return;
    }

  } catch(e) {
    console.log(e);
  }

  obj.response.json({error_code:90020, error_message:'Invalid operation.'});
}

exports.myFunc = myfunc;
