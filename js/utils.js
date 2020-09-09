
const path = require('path');
const nconf = require('nconf');
const redis = require('redis');

//const JSEncrypt = require('jsencrypt');
const JSEncrypt = require('node-jsencrypt');

const CryptoJS = require("crypto-js");

const publicKey = require('./public.key.js');
const privateKey = require('./private.key.js');
const licensePrivateKey = require('./license.key.js');

const moment = require('moment');

({exec} = require('child_process'));

const SUN_PREFIX = ['922','923','924','925','931','932','933','934','941','942','943','944'];

const GLOBE_PREFIX = ['817','904','905','906','915','916','917','925','926','927','935','936','937','945','955','956','965','966','967','973','975','976','977','978','979','994','995','997'];

const SMART_PREFIX = ['813','908','911','913','914','918','919','920','921','928','929','939','947','949','961','970','981','989','998','999'];

const TNT_PREFIX = ['907','909','910','912','930','938','946','948','950','951'];

const DEFAULT_NETWORKS = ['smart','sun','globe','tnt'];

var Utils;

module.exports = (function () {

  Utils = function(basepath, localRedis, db) {
    this.basePath = basepath;
    this.localRedis = localRedis;
    this.db = db;
  };

  Utils.prototype.CryptoJS = {
    AES: CryptoJS.AES,
    enc: CryptoJS.enc,
  };

  Utils.prototype.Moment = function(a,b,c) {
    return moment(a,b,c);
  };

  Utils.prototype.crypt = function() {
    return new JSEncrypt();
  };

  Utils.prototype.unixStamp = function(f) {

    if(f) {
      return moment().format(f);
    }
    return moment().format('x');
  };

  Utils.prototype.uuid4 = require('uuid4');

  Utils.prototype.sha1 = require('sha1');

  Utils.prototype.gen256key = function() {
    return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  Utils.prototype.gen256hexkey = function() {
    return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  Utils.prototype.defaultPublicKey = function() {
    return publicKey.publicKey;
  };

  Utils.prototype.defaultPrivateKey = function() {
    return privateKey.privateKey;
  };

  Utils.prototype.getRandomInt = function(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  Utils.prototype.checkNetwork = function(mobileno) {
    var self = this;

    var ret = self.isValidMobileNumber2(mobileno);

    if(ret&&ret[2]) {
      var net = ''+ret[2];

      if(SUN_PREFIX.includes(net)) {
        return 'sun';
      }

      if(GLOBE_PREFIX.includes(net)) {
        return 'globe';
      }

      if(TNT_PREFIX.includes(net)) {
        return 'tnt';
      }

      if(SMART_PREFIX.includes(net)) {
        return 'smart';
      }
    }

    return false;
  }

  Utils.prototype.isValidMobileNumber = function(mobileno) {
    var self = this;

    var regex = /(0\d{3})(\d{3})(\d{4})/;

    return regex.exec(mobileno);
  }

  Utils.prototype.isValidMobileNumber2 = function(mobileno) {
    var self = this;

    var regex = /(0)(\d{3})(\d{3})(\d{4})/;

    return regex.exec(mobileno);
  }

  Utils.prototype.genRSAKeys = function(keySize) {
    var kSize = parseInt(keySize);

    var crypt = new JSEncrypt({default_key_size: kSize});

    crypt.getKey();

    var privateKey = crypt.getPrivateKey();
    var publicKey = crypt.getPublicKey();

    return {privateKey:privateKey, publicKey:publicKey};
  };

  Utils.prototype.Encrypt = function(obj, pkey) {
    var self = this;
    var myString = JSON.stringify(obj);
    var gkey = this.gen256hexkey();
    var giv = this.gen256key();

    var key = this.CryptoJS.enc.Hex.parse(gkey);

    var iv =  this.CryptoJS.enc.Hex.parse(giv);

    var ct = this.CryptoJS.AES.encrypt(myString, key, { iv: iv });

    var encrypted = ct.ciphertext.toString(this.CryptoJS.enc.Base64);

    var crypt = self.crypt();

    if(pkey) {
      crypt.setPublicKey(pkey);
    } else {
      crypt.setPublicKey(self.defaultPublicKey());
    }

    var aesKeys = {pkey:gkey, piv: giv};

    var rsaEncrypted = crypt.encrypt(JSON.stringify(aesKeys));

    return {data:encrypted, hash:rsaEncrypted};
  };

  Utils.prototype.Decrypt = function(data, pkey) {
    var self = this;

    var crypt = self.crypt();

    if(!pkey) {
      crypt.setPrivateKey(self.defaultPrivateKey());
    } else {
      crypt.setPrivateKey(pkey);
    }

    var decrypted = crypt.decrypt(data.hash);

    decrypted = JSON.parse(decrypted);

    var key = self.CryptoJS.enc.Hex.parse(decrypted.pkey);

    var iv =  self.CryptoJS.enc.Hex.parse(decrypted.piv);

    var bytes = self.CryptoJS.AES.decrypt(data.data, key, { iv: iv });

    var plaintext = bytes.toString(self.CryptoJS.enc.Utf8);

    return {hash:decrypted, data:JSON.parse(plaintext)};
  };

  Utils.prototype.getMac = function(cb) {
    const command = "/sbin/ifconfig -a || /sbin/ip link";
    const macRegex = /(?:[a-z0-9]{2}[:\-]){5}[a-z0-9]{2}/ig;

    exec(command, function (err, stdout, stderr) {
      match = stdout.match(macRegex);
      if(typeof(cb)=='function') {
        cb(match);
      } else {
        console.log(match);
      }
    })
  }

  Utils.prototype.checkLicense = function() {
    var self = this;

    const licenseFile = path.join(self.basePath, 'license.json');

    console.log('LICENSEFILE: '+licenseFile);

    nconf.use('file', { file: licenseFile });

    var license = nconf.get('license');

    //console.log(license);

    //console.log(licensePrivateKey.licPriKey);

    //var decrypted = self.Decrypt(obj.request, licensePrivateKey.licPriKey);

    var crypt = self.crypt();

    crypt.setPrivateKey(licensePrivateKey.licPriKey);

    var decrypted = crypt.decrypt(license);

    console.log(decrypted);

  }

  Utils.prototype.genId = function(node, altname) {
    var self = this;

    var gname = altname ? altname : 'genid';

    return new Promise((resolve, reject) => {

      node = parseInt(node) ? parseInt(node) : 1;

      self.localRedis.eval("redis.replicate_commands(); local t=redis.call('TIME')[1]; local x=redis.call('INCR',KEYS[1]); if x>99999 then redis.call('SET',KEYS[1],0); x=0; end return t .. string.format('%04d',ARGV[1]) .. string.format('%05d',x)", 1, gname+':'+node, node, function(err, key){
        if(err){
          reject(err);
          return;
        }
        //console.log(err, id);
        resolve(key);
        return;
      });

    });

  }

  Utils.prototype.genId2 = function(node) {
    var self = this;

    return new Promise((resolve, reject) => {

      node = parseInt(node) ? parseInt(node) : 100;

      if(node>=100&&node<=999) {
      } else {
        node = 100;
      }

      self.localRedis.incr('genid:'+node, (err, ctr) => {
        if(err){
          reject(err);
          return;
        }
        self.localRedis.time((err, time) => {
          console.log({ctr: ctr, seconds: time[0], millis: time[0] * 1000, milli: time[1] / 1000});

          if(err) {
            reject(err);
            return;
          }
          var key = time[0];
          var div = Number((ctr / 1000000).toFixed());
          ctr = ctr - (div * 1000000);
          key = key.toString() + ((node * 1000000) + ctr).toString();
          resolve(key);
          return;
        });
      });
    });
  }

  Utils.prototype.getCashierAccount = async function() {
    var self = this;

    var account = await new Promise((resolve, reject) => {

      try {

        self.localRedis.get('ecpcashieraccount', function(err, account){
          if(err) {
            resolve(false);
          } else {
            if(account) {
              account = JSON.parse(account);
              resolve(account);
            } else {
              resolve(false);
            }
          }
        });

      } catch(e) {
        console.log(e);
        resolve(false);
      }


    });

    if(account) {
      return new Promise((resolve, reject) => {
        console.log('ecpcashieraccount from cache');
        resolve(account);
      });
    }

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_user WHERE user_type='CASHIER'";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          if(result&&result.rows&&result.rows[0]) {

            self.localRedis.set('ecpcashieraccount', JSON.stringify(result.rows[0]), 'EX', 300, redis.print);

            resolve(result.rows[0]);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });
  }

  Utils.prototype.getCashoutAccount = async function() {
    var self = this;

    var account = await new Promise((resolve, reject) => {

      try {

        self.localRedis.get('ecpcashoutaccount', function(err, account){
          if(err) {
            resolve(false);
          } else {
            if(account) {
              account = JSON.parse(account);
              resolve(account);
            } else {
              resolve(false);
            }
          }
        });

      } catch(e) {
        console.log(e);
        resolve(false);
      }


    });

    if(account) {
      return new Promise((resolve, reject) => {
        console.log('ecpcashoutaccount from cache');
        resolve(account);
      });
    }

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_user WHERE user_type='CASHOUT'";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          if(result&&result.rows&&result.rows[0]) {

            self.localRedis.set('ecpcashoutaccount', JSON.stringify(result.rows[0]), 'EX', 300, redis.print);

            resolve(result.rows[0]);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });
  }

  Utils.prototype.getServiceChargeAccount = async function() {
    var self = this;

    var account = await new Promise((resolve, reject) => {

      try {

        self.localRedis.get('ecpservicechargeaccount', function(err, account){
          if(err) {
            resolve(false);
          } else {
            if(account) {
              account = JSON.parse(account);
              resolve(account);
            } else {
              resolve(false);
            }
          }
        });

      } catch(e) {
        console.log(e);
        resolve(false);
      }


    });

    if(account) {
      return new Promise((resolve, reject) => {
        console.log('ecpservicechargeaccount from cache');
        resolve(account);
      });
    }

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_user WHERE user_type='SERVICECHARGE'";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          if(result&&result.rows&&result.rows[0]) {

            self.localRedis.set('ecpservicechargeaccount', JSON.stringify(result.rows[0]), 'EX', 300, redis.print);

            resolve(result.rows[0]);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });
  }

  Utils.prototype.getAdminChargeAccount = async function() {
    var self = this;

    var account = await new Promise((resolve, reject) => {

      try {

        self.localRedis.get('ecpadminchargeaccount', function(err, account){
          if(err) {
            resolve(false);
          } else {
            if(account) {
              account = JSON.parse(account);
              resolve(account);
            } else {
              resolve(false);
            }
          }
        });

      } catch(e) {
        console.log(e);
        resolve(false);
      }


    });

    if(account) {
      return new Promise((resolve, reject) => {
        console.log('ecpadminchargeaccount from cache');
        resolve(account);
      });
    }

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_user WHERE user_type='ADMINCHARGE'";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          if(result&&result.rows&&result.rows[0]) {

            self.localRedis.set('ecpadminchargeaccount', JSON.stringify(result.rows[0]), 'EX', 300, redis.print);

            resolve(result.rows[0]);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });
  }

  Utils.prototype.getUserAccountById = async function(user_id) {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_user WHERE user_id='"+user_id+"'";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          if(result&&result.rows&&result.rows[0]) {

            var fullname = [];

            if(result.rows[0].user_firstname) {
              fullname.push(result.rows[0].user_firstname);
            }

            if(result.rows[0].user_middlename) {
              fullname.push(result.rows[0].user_middlename);
            }

            if(result.rows[0].user_lastname) {
              fullname.push(result.rows[0].user_lastname);
            }

            result.rows[0].fullname = fullname.join(' ');

            self.localRedis.hset('ecpfullnames','FID'+result.rows[0].user_id, fullname.join(' '), redis.print)

            resolve(result.rows[0]);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });
  }

  Utils.prototype.getUserAccountByFbId = async function(user_fbid) {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_user WHERE user_fbid='"+user_fbid+"' and user_fbverified=1";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          if(result&&result.rows&&result.rows[0]) {

            var fullname = [];

            if(result.rows[0].user_firstname) {
              fullname.push(result.rows[0].user_firstname);
            }

            if(result.rows[0].user_middlename) {
              fullname.push(result.rows[0].user_middlename);
            }

            if(result.rows[0].user_lastname) {
              fullname.push(result.rows[0].user_lastname);
            }

            result.rows[0].fullname = fullname.join(' ');

            //self.localRedis.hset('ecpfullnames','FID'+result.rows[0].user_id, fullname.join(' '), redis.print)

            resolve(result.rows[0]);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });
  }

  Utils.prototype.getUserAccountByLogin = async function(user_login) {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_user WHERE user_login='"+user_login+"'";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          if(result&&result.rows&&result.rows[0]) {

            var fullname = [];

            if(result.rows[0].user_firstname) {
              fullname.push(result.rows[0].user_firstname);
            }

            if(result.rows[0].user_middlename) {
              fullname.push(result.rows[0].user_middlename);
            }

            if(result.rows[0].user_lastname) {
              fullname.push(result.rows[0].user_lastname);
            }

            result.rows[0].fullname = fullname.join(' ');

            self.localRedis.hset('ecpfullnames','FID'+result.rows[0].user_id, fullname.join(' '), redis.print)

            resolve(result.rows[0]);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });
  }

  Utils.prototype.getUserFullNameById = async function(user_id) {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        self.localRedis.hget('ecpfullnames', 'FID'+user_id, async function(err, fullname){
          if(err) {
            resolve(false);
            console.log(err)
          } else {
            try {
              if(fullname) {
                resolve(fullname);
              } else {
                var userAccount = await self.getUserAccountById(user_id);
                //console.log({userAccount:userAccount});
                if(userAccount&&userAccount.fullname) {
                  resolve(userAccount.fullname);
                } else {
                  resolve('NO NAME');
                }
              }
            } catch(e) {
              console.log(e);
              resolve(false);
            }
          }
        })

      } catch(e) {
        console.log(e);
        resolve(false);
      }
    });
  }

  Utils.prototype.getBuyLoadQueued = async function() {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_buyload WHERE buyload_status in ('QUEUED', 'PENDING','CHECKING')";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          if(result&&result.rows&&result.rows[0]) {
            resolve(result.rows);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });
  }

  Utils.prototype.getBuyLoadNew = async function() {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_buyload WHERE buyload_status in ('NEW')";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          if(result&&result.rows&&result.rows[0]) {
            resolve(result.rows);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });
  }

  Utils.prototype.cacheOptions = async function() {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT * FROM tbl_options";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          //console.log(result);

          if(result&&result.rows&&result.rows[0]) {

            self.localRedis.del('ecpoptions');

            for(var x in result.rows) {
              self.localRedis.hset('ecpoptions', result.rows[x].options_name, result.rows[x].options_value, redis.print);
            }

            resolve(true);
          } else {
            resolve(true);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });

  };

  Utils.prototype.getOption = async function(option_name, default_value) {
    var self = this;

    return new Promise(async (resolve, reject) => {

      try {

        var option_data = await new Promise((resolve, reject) => {
          self.localRedis.hget('ecpoptions', option_name, function(err, optionData){
            console.log(optionData);
            if(err) {
              resolve(false);
            } else {
              try {
                resolve(optionData);
              } catch(e) {
                resolve(false);
              }
            }
          })
        });

        if(option_data!==false) {
          console.log('from cache');
          resolve(option_data);
          return;
        }

        const sql = "SELECT * FROM tbl_options WHERE options_name='"+option_name+"'";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          //console.log(result);

          if(result&&result.rows&&result.rows[0]) {
            resolve(result.rows[0].options_value);
          } else {
            resolve(default_value);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(default_value);
        });

      } catch(e) {
        console.log(e);
        resolve(default_value);
      }

    });
  }

  Utils.prototype.setOption = async function(option_name, option_value) {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        self.localRedis.hset('ecpoptions', option_name, option_value, redis.print);

        const sql = "with upsert as (update tbl_options set options_value='"+option_value+"', options_timestamp=now() where options_name='"+option_name+"' returning *) insert into tbl_options (options_name, options_value) select '"+option_name+"','"+option_value+"' as insertdata where not exists (select * from upsert)";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          resolve(option_value);
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(option_value);
        });

      } catch(e) {
        console.log(e);
        resolve(option_value);
      }

    });
  }

  Utils.prototype.getSessionData = async function(sid) {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        self.localRedis.hget('ecpsessions', sid, function(err, sessionData){
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
        })

      } catch(e) {
        console.log(e);
        resolve(false);
      }
    });
  }

  Utils.prototype.getCashOutTotal = async function(user_id) {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT SUM(cashout_amount) as total FROM tbl_cashout WHERE cashout_userid="+user_id+" AND cashout_status=1";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          //console.log(result);

          if(result&&result.rows&&result.rows[0]) {
            resolve(result.rows[0].total);
          } else {
            resolve(0);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(0);
        });

      } catch(e) {
        console.log(e);
        resolve(0);
      }
    });
  }

  Utils.prototype.sendFCM = async function(obj) {
    var self = this;

    try {
      var json = {
        id: await self.genId(6),
        key: obj.key,
        topic: obj.topic,
        title: obj.title,
        body: obj.body,
      }

      self.localRedis.lpush('fcmpushqueue', JSON.stringify(json), redis.print);

      return true;
    } catch(e) {
      console.log(e);
      return false;
    }

  }

  Utils.prototype.cacheEloadProducts = async function() {
    var self = this;

    return new Promise((resolve, reject) => {

      try {

        const sql = "SELECT eloadproduct_id,eloadproduct_pcode,eloadproduct_name,eloadproduct_provider,eloadproduct_amount,eloadproduct_subcarrier FROM tbl_eloadproduct WHERE eloadproduct_active=1 and eloadproduct_subcarrier!='' ORDER BY eloadproduct_name";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          //console.log(result);

          if(result&&result.rows&&result.rows[0]) {

            var providers = {};

            self.localRedis.del('ecpeloadproducts');

            for(var x in result.rows) {
              if(!providers[result.rows[x].eloadproduct_provider]) {
                providers[result.rows[x].eloadproduct_provider] = [];
              }

              var pcode = result.rows[x].eloadproduct_pcode + '_' + result.rows[x].eloadproduct_provider;
              var json = JSON.stringify(result.rows[x]);

              providers[result.rows[x].eloadproduct_provider].push(json);

              self.localRedis.hset('ecpeloadproducts', pcode, result.rows[x].eloadproduct_id, redis.print);
            }

            for(var x in providers) {
              if(providers[x].length) {
                self.localRedis.del('ecpeloadproducts'+x);

                for(var y in providers[x]) {
                  var pjson = JSON.parse(providers[x][y]);
                  self.localRedis.hset('ecpeloadproducts'+x, pjson.eloadproduct_id, providers[x][y], redis.print);
                }
              }
            }

            //console.log(providers);

            resolve(true);
          } else {
            resolve(true);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        resolve(false);
      }

    });

  };

  Utils.prototype.getAllProductsFromDb = async function() {
    var self = this;

    return new Promise((resolve, reject) => {
      try {

        const sql = "select eloadproduct_id,eloadproduct_pcode,eloadproduct_name,eloadproduct_amount,eloadproduct_provider,eloadproduct_subcarrier from tbl_eloadproduct where eloadproduct_subcarrier<>'' order by eloadproduct_subcarrier asc, eloadproduct_name asc";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          //console.log(result);

          if(result&&result.rows&&result.rows[0]) {
            resolve(result.rows);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        console.log(e)
        resolve(false);
      }
    });
  }

  Utils.prototype.getProductsFromDb = async function(network) {
    var self = this;

    return new Promise((resolve, reject) => {
      try {

        const sql = "select eloadproduct_id,eloadproduct_pcode,eloadproduct_name,eloadproduct_amount, eloadproduct_subcarrier from tbl_eloadproduct where eloadproduct_provider='"+network+"' and eloadproduct_subcarrier<>'' order by eloadproduct_subcarrier asc, eloadproduct_name asc";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          //console.log(result);

          if(result&&result.rows&&result.rows[0]) {
            resolve(result.rows);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        console.log(e)
        resolve(false);
      }
    });
  }

  Utils.prototype.getMyPoints = async function(user_login) {
    var self = this;

    return new Promise(async (resolve, reject) => {
      try {

        var userAccount = await self.getUserAccountByLogin(user_login);

        if(userAccount&&userAccount.user_loadwallet&&parseFloat(userAccount.user_loadwallet)>0) {
          resolve(parseFloat(userAccount.user_loadwallet));
          //return;
        } else {
          resolve(false);
          //return;
        }

      } catch(e) {
        console.log(e)
        resolve(false);
      }
    });
  }

  Utils.prototype.getMyPointsById = async function(user_id) {
    var self = this;

    return new Promise(async (resolve, reject) => {
      try {

        var userAccount = await self.getUserAccountById(user_id);

        if(userAccount&&userAccount.user_loadwallet&&parseFloat(userAccount.user_loadwallet)>0) {
          resolve(parseFloat(userAccount.user_loadwallet));
          //return;
        } else {
          resolve(false);
          //return;
        }

      } catch(e) {
        console.log(e)
        resolve(false);
      }
    });
  }

  Utils.prototype.getProducts = async function(network) {
    var self = this;

    return new Promise((resolve, reject) => {
      try {

        self.localRedis.hgetall('ecpeloadproducts'+network, async function(err, ret){
          if(err) {
            resolve(false);
          } else {

            if(ret) {
              var rows = [];

              for(var x in ret) {
                var json = JSON.parse(ret[x]);
                rows.push(json);
              }

              resolve(rows);

            } else {
              resolve(false);
            }
          }
        });

      } catch(e) {
        console.log(e);
        resolve(false);
      }

    });


  }

  Utils.prototype.getEloadProduct = async function(pcode, network) {
    var self = this;

    return new Promise((resolve, reject) => {
      try {

        self.localRedis.hget('ecpeloadproducts', pcode+'_'+network, async function(err, ret){
          if(err) {
            //console.log('an error has occured');
            resolve(false);
          } else {
            //console.log(err);
            //console.log(ret);

            if(ret) {
              self.localRedis.hget('ecpeloadproducts'+network, ret, async function(err, ret){
                if(err) {
                  resolve(false);
                } else {
                  if(ret) {
                    resolve(JSON.parse(ret));
                  } else {
                    resolve(false);
                  }
                }
              });
            } else {
              resolve(false);
            }
          }
        });

      } catch(e) {
        console.log(e);
        resolve(false);
      }

    });


  }

  Utils.prototype.refundLoad = async function(buyData, db) {
    var self = this;

    if(db&&buyData&&buyData.buyload_id&&buyData.buyload_amount) {
    } else {
      return false;
    }

    return new Promise(async (resolve, reject) => {
      try {

        var origAmount = parseFloat(buyData.buyload_origamount);

        var amount = parseFloat(buyData.buyload_amount);

        var mobilenumber = buyData.buyload_receiverno;

        var pcode = buyData.buyload_pcode;

        var network = buyData.buyload_provider;

        var adminChargeAmount = parseFloat(buyData.buyload_admincharge);

        var cashierAmount = amount - adminChargeAmount;

        var userAccount = await self.getUserAccountByLogin(buyData.buyload_userlogin);

        var adminChargeAccount = await self.getAdminChargeAccount();

        var cashierAccount = await self.getCashierAccount();

        var dbClient = await db.Connect();

        await db.Query('BEGIN', null, null, dbClient);
        await db.Query('LOCK TABLE tbl_transaction IN EXCLUSIVE MODE', null, null, dbClient);

        var transaction_desc = pcode + ' LOAD ' + origAmount + ' TO ' + mobilenumber;

        var content = {};
        content['transaction_userid'] = userAccount.user_id;
        content['transaction_userlogin'] = userAccount.user_login;
        content['transaction_usertype']  = userAccount.user_type;
        content['transaction_amount']  = amount;
        content['transaction_type']  = 'buyload_charge_refund';
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
          //obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          return;
        }, dbClient);

        if(!res) {
          resolve(false);
        }

        var myUserBal = 0;
        var tranId = 0;

        try {
          myUserBal = res.rows[0].transaction_userbal;
          tranId = res.rows[0].transaction_id;
        } catch(e) {
          console.log(e);
        }

        var content = {};
        content['transaction_userid'] = cashierAccount.user_id;
        content['transaction_userlogin'] = cashierAccount.user_login;
        content['transaction_usertype']  = cashierAccount.user_type;
        content['transaction_amount']  = cashierAmount * -1;
        content['transaction_type']  = 'buyload_cashier_refund';
        content['transaction_desc'] = transaction_desc;
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
          //obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
          return;
        }, dbClient);

        if(!res) {
          resolve(false);
        }

        var cashierBal = 0;
        var adminBal = 0;

        try {
          cashierBal = res.rows[0].transaction_userbal;
        } catch(e) {
          console.log(e);
        }

        if(adminChargeAmount) {

          var content = {};
          content['transaction_userid'] = adminChargeAccount.user_id;
          content['transaction_userlogin'] = adminChargeAccount.user_login;
          content['transaction_usertype']  = adminChargeAccount.user_type;
          content['transaction_amount']  = adminChargeAmount * -1;
          content['transaction_type']  = 'buyload_admincharge_refund';
          content['transaction_desc'] = transaction_desc;
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
            //obj.response.json(utils.Encrypt({error_code:90025, error_message:error.error}, decrypted.data.pkey));
            return;
          }, dbClient);

          if(!res) {
            resolve(false);
          }

          try {
            adminBal = res.rows[0].transaction_userbal;
          } catch(e) {
            console.log(e);
          }

          await db.Query('COMMIT', null, null, dbClient);

          var userAccount = await self.getUserAccountByLogin(buyData.buyload_userlogin);

          var ret = {
            user_id: userAccount.user_id,
            user_login: userAccount.user_login,
            user_balance: userAccount.user_loadwallet,
            trans_id: tranId,
          }

          try {
            if(cashierAccount&&cashierAccount.user_id) {
              ret.cashierId = cashierAccount.user_id;

              if(cashierBal) {
                ret.cashierBal = cashierBal;
              }
            }

            if(adminChargeAccount&&adminChargeAccount.user_id) {
              ret.adminId = adminChargeAccount.user_id;

              if(adminBal) {
                ret.adminBal = adminBal;
              }
            }

          } catch(e) {
            console.log(e);
          }

          console.log({refundLoad: ret});

          resolve(ret);
        }

      } catch(e) {
        console.log(e);
        resolve(false);
      }

    });


  }

  Utils.prototype.getEcommerceProductUsingId = async function(pid) {
    var self = this;

    return new Promise((resolve, reject) => {
      try {

        const sql = "select * from tbl_product where product_id='"+pid+"'";

        console.log(sql);

        var res = self.db.Query(sql, (client, result) => {
          client.release();

          //console.log(result);

          if(result&&result.rows&&result.rows[0]) {
            resolve(result.rows[0]);
          } else {
            resolve(false);
          }
          //console.log(result);
        }, (error) => {
          console.log('ERROR!');
          console.log(error);
          resolve(false);
        });

      } catch(e) {
        console.log(e)
        resolve(false);
      }
    });
  }

  return Utils;

})();
