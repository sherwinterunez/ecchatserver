
const request = require('request');
const moment = require('moment');

const FCM_SERVER_KEY = "AAAASyg8sD4:APA91bE9Khrml8SZ_2bEdxCq2C2gR2oH0AcWtiodtyw5NXzuQikcfHcZWlF2XhS3x7ohvC_nBsdZpYLek8gkOnyTuWDYQ53wy1QcTFMLAo9SNkhExdcJmp7OAP3HsKtosLRniStK5SUB";

const FCM_DEFAULT_TOPIC = 'ECPREMIER';

exports.send = async function(data) {

  return await new Promise((resolve, reject) => {
    try {
      if(data&&data.id&&data.key&&data.topic&&data.title&&data.body) {

        var topic = '/topics/' + data.topic;

        var title = 'Sample Title';
        var body = 'This is a sample body message.';

        if(data.title) {
          title = data.title;
        }

        if(data.body) {
          body = data.body;
        }

        var msg = {
          title: title,
          body: body,
          sound: 'default',
          click_action: 'FCM_PLUGIN_ACTIVITY',
          //'icon': 'fcm_push_icon',
          high_priority: 'high',
      		show_in_foreground: true
        }

        var datax = {
          title: title,
          body: body,
          timestamp: moment().format('x'),
        }

        var fields = {
          to: topic,
      		notification: msg,
      		delay_while_idle: false,
      		content_available: true,
          priority: 'high',
          time_to_live: 86400,
          data: datax,
        }

        var headers = {
          'Authorization': 'key='+data.key,
      		'Content-Type': 'application/json',
        }

        var options = {
          uri: 'https://fcm.googleapis.com/fcm/send',
          method: 'POST',
          json: fields,
          headers: headers,
        }

        request(options, function(error, response, body) {
          if(error) {
            //console.log({error: error});
            resolve({error: error});
          } else {
            //console.log({response: response});
            //console.log({body: body});
            resolve({error: null, body: body});
          }
        });

        //resolve(fields);
      }
    } catch(e) {
      resolve({error:e});
    }
  });
}


// eof
