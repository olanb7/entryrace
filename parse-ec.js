var request = require('request'),
    u = require('underscore'),
    redis = require('redis'),
    async = require('async'),
    MailChimpAPI = require('mailchimp').MailChimpAPI,
    CronJob = require('cron').CronJob,
    fs = require('fs'),
    file = __dirname + '/ec.json';

var API_KEY = 'MAILCHIMP_API_KEY',
    REDIS_PASS = 'REDIS_PASS',
    REDIS_PORT = 10045,
    REDIS_DNS = 'HOST.garantiadata.com',
    campaignId, cron, api, client;

//
// helpers
//

function expires(ms) {
  return new Date(Date.now() + ms).toUTCString();
}

function cacheExpire(input) {
  var parts = input.match(/(\d+)/g),
      closes = new Date(parts[2], parts[1] - 1, parts[0]);

  return closes.getTime();
}

//
// callbacks
//

function sendCampaign(replica, callback) {

  api.campaignSendNow({cid: replica}, function(error) {
    if (!error) {
      console.log('>> mail sent | ' + new Date().toUTCString());
    } else {
      console.log(error.message);
    }
    callback();
  });

}

function updateMailContent(id, obj, callback) {

  var relativeLink = /^(?:.*)(index.php\?.*=[0-9]+)>(.*)<(?:.*)$/.exec(obj.url)[1],
    link = '<a href=\'http://www.entrycentral.com/' + relativeLink + '\'>' + obj.text + '</a>',
    preheader = 'Just opened: ' + obj.text,
    body = 'Looks like ' + link + ' has just opened. Places can go quick, so get on it.';

    api.campaignUpdate({cid: id, name: 'content', value: {
      'html_std_content00': body,
      'html_std_preheader_content': preheader,
      'html_header_text': link
    }}, function(err) {
      if (err) {
        console.log(err);
        callback();
      } else {
        sendCampaign(id, callback);
      }
    });

}

function replicateCampaign(id, event, callback) {

  api.campaignReplicate({cid: id}, function(error, id) {

    if (error) {
      console.log(error.message);
      callback();
    }
    updateMailContent(id, event, callback);
  });
}

function handleResponse(content, id) {

    var events = content.aaData;

    async.each(events, function(evt, callback) {

      var obj = u.object(['url', 'closes', 'status', 'opened', 'dist'], evt),
          re = /^(?:.*)=([0-9]+)>(.*)<(?:.*)$/,
          expires = cacheExpire(obj.closes),
          match = re.exec(obj.url);

      obj.id = match[1];
      obj.text = match[2];

      //console.log('> testing ' + obj.text + ' | ' + new Date().toUTCString() + '\n');

      if (obj.status !== 'Closed') {

        client.get(obj.id, function(err, reply) {

          if (!err && !reply) {
            console.log('>> adding: ' + obj.text + ' | ' + new Date().toUTCString());
            client.set(obj.id, JSON.stringify(obj));
            client.expireat(obj.id, expires);
            replicateCampaign(id, obj, callback);
          } else {
            console.log('>> exists: ' + obj.text + ' | ' + new Date().toUTCString());
            callback();
          }
        });

      } else {
        console.log('>> skipping closed: ' + obj.text + ' | ' + new Date().toUTCString());
        callback();
      }

    }, function(err) {
      if (err) {
        console.log('>> encountered error checking ec! | ' + new Date().toUTCString());
      }
      console.log('>> finished check | ' + new Date().toUTCString());
    });
}

function pollEC(data, id) {

  var j = request.jar();

  // add cookies to jar
  Object.keys(data.cookies).forEach(function(key) {
    j.add(request.cookie(key + '=' + data.cookies[key] + '; path=/; expires=' + expires(1000)));
  });

  // make the request
  request({url: data.url, jar: j}, function(error, response, body) {

    if (!error && response.statusCode === 200) {
      handleResponse(JSON.parse(body), id);
    } else if (error) {
      console.log(error.message);
    } else {
      console.log(response.statusCode);
    }
  });

}

/**
 * Get the local configuration file and use it's details to poll.
 */
function getConfig(id) {

  //console.info('> getConfig: ' + id);

  fs.readFile(file, 'utf8', function(err, data) {
    if (err) {
      console.log('Error: ' + err);
      return;
    }

    pollEC(JSON.parse(data), id);
  });
}

/**
 * Gets the campaign from mailchimp and calls back to read in the config.
 */
function getCampaign() {

  api = new MailChimpAPI(API_KEY, {version: '1.3', secure: false});

  // get the specified campaign
  api.campaigns({filters: {title: 'parse-ec-mail'}, limit: 1}, function(error, data) {
    if (error) {
       console.log(error.message);
    } else {
      campaignId = data.data[0].id;
      getConfig(campaignId);
    }
  });
}

/**
 * Kicks off the polling instance. Calls `getCampaign` every 5 minutes.
 */
function start() {

  console.log('-- starting...');

  cron = new CronJob('0 */5 * * * *', function() {
    getCampaign();
  }, function() {
      console.log('exited');
  }, true, 'America/Los_Angeles');
}

//
// kick it off..
//

console.log('== entrycentral scan | ' + new Date().toUTCString() + ' ===');

client = redis.createClient(REDIS_PORT, REDIS_DNS);
client.auth(REDIS_PASS, function(err, res) {
  if (res) {
    console.log('-- authenticated ok!');
    start();
  } else {
    console.log(err);
  }
});


