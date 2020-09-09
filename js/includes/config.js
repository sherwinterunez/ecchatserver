
const nconf = require('nconf');

const Utils = require('../utils.js');

var myfunc = function(obj) {
  //console.log(request);

  var utils = new Utils();

  var decrypted = utils.Decrypt(obj.request);

  //console.log({decrypted:decrypted});

  nconf.use('file', { file: obj.configFile });

  var config = nconf.get('config');

  var data = {success:1, config: config}

  console.log(data);

  var ret = utils.Encrypt(data, decrypted.data.pkey);

  //response.json({ success: 'Successful!', ret: ret });

  //console.log(ret);

  obj.response.json(ret);
}

exports.myFunc = myfunc;
