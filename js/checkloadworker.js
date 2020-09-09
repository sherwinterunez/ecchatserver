
const request = require('request');
const moment = require('moment');

//const FCM_SERVER_KEY = "AAAASyg8sD4:APA91bE9Khrml8SZ_2bEdxCq2C2gR2oH0AcWtiodtyw5NXzuQikcfHcZWlF2XhS3x7ohvC_nBsdZpYLek8gkOnyTuWDYQ53wy1QcTFMLAo9SNkhExdcJmp7OAP3HsKtosLRniStK5SUB";

//const FCM_DEFAULT_TOPIC = 'ECPREMIER';

//const API_ACCOUNT = '09661652233';
//const API_KEY = '41e5a95af4414b983e3e4d34fa621c98a664f324e296b889e6b5a0fb3d547f39';

const API_ACCOUNT = '09474220659';
const API_KEY = 'e02350d23da246f579cb6242de0a00357233e899169fcd6427ecfa6129f92d6f';

const API_URL = 'https://api.loadconnect.net/remote.php';

exports.send = async function(data) {

  return await new Promise((resolve, reject) => {
    try {

      data.key = API_KEY;
      data.account = API_ACCOUNT;

      var pdata = data.pdata;

      data.pdata = '';

      var options = {
        uri: API_URL,
        method: 'POST',
        form: data,
        headers: {'content-type': 'application/json'},
      }

      request(options, function(error, response, body) {
        if(error) {
          //console.log({error: error});
          resolve({err: 'err1', error: error, data: data});
        } else {
          //console.log({response: response});
          //console.log({body: body});
          var retdata = {}

          try {
            retdata = JSON.parse(body);
          } catch(e) {
            console.log(e);
          }

          resolve({err: 'err2', error: null, body: body, retdata: retdata, pdata: pdata});
        }
      });

      //resolve({error: null, data: data});
    } catch(e) {
      resolve({err: 'err3', error: e});
    }
  });
}


// eof
