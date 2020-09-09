
const fs = require('fs');
const path = require('path');
const nconf = require('nconf');
const moment = require('moment');
const redis = require('redis');
const uuid4 = require('uuid4');
const sharp = require('sharp');
const Utils = require('../utils.js');
const Database = require('../db.js');

//const DEFAULT_PATH = path.dirname(process.argv[1]);

const DEFAULT_PATH = process.cwd();

var myfunc = async function(obj) {

  var db = new Database(obj.pool);

  var localRedis = obj.localRedis;

  var utils = new Utils(null, localRedis);

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

      if(!data.blob) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data received.'}, decrypted.data.pkey));
        return;
      }

      try {
        var blob = data.blob.split(';base64,').pop();
      } catch(e) {
        console.log(e);
      }

      if(!blob) {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'Invalid data received.'}, decrypted.data.pkey));
        return;
      }

      var ffile = sessionData.user_id+'.jpg';

      var fpath = DEFAULT_PATH + '/images/' + ffile;

      console.log(fpath);

      var success = await new Promise((resolve, reject) => {

        try {
          fs.unlinkSync(fpath);
        } catch(e) {
          console.log(e);
        }

        fs.writeFile(fpath, blob, {encoding: 'base64'}, function(err) {
          if(err) {
            console.log(err);
            resolve(0);
            return;
          }
          console.log('File created');

          fs.access(fpath, fs.F_OK, (err) => {
            if (err) {
              console.error(err)
              resolve(0);
              return;
            }
            //file exists
            resolve(1);
          })
        });

      });


      //console.log(blob);

      if(success) {

        var tfile = DEFAULT_PATH + '/thumbs/' +ffile;

        try {
          fs.unlinkSync(tfile);
        } catch(e) {
          console.log(e);
        }

        console.log({fpath:fpath, tfile:tfile});

        sharp(fpath)
          .resize(128, 128)
          .toFile(tfile, function(err) {
            console.log(err);
            // output.jpg is a 300 pixels wide and 200 pixels high image
            // containing a scaled and cropped version of input.jpg
          });

        var retdata = {success:1, upload: 1, file: ffile}

        //console.log(retdata);

        var ret = utils.Encrypt(retdata, decrypted.data.pkey);

        obj.response.json(ret);

        return;

      } else {
        obj.response.json(utils.Encrypt({error_code:90021, error_message:'An error has occured while saving photo.'}, decrypted.data.pkey));
        return;
      }

    }

  } catch(e) {
    console.log(e);
  }

  obj.response.json({error_code:90020, error_message:'Invalid operation.'});
}

exports.myFunc = myfunc;
