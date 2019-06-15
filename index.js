global._mckay_statistics_opt_out = true;
process.env.HOME = __dirname + '/cache';

var SteamUser = require('steam-user');
var Express = require('express');

var systemdSocket = require('systemd-socket');
var request = require('request');
var parseXml = require('xml2js').parseString;

var userOptions = {
  dataDirectory: __dirname + '/cache',
};

var user = new SteamUser(null, userOptions);

user.logOn(); // Log onto Steam anonymously

var app = new Express();

if (systemdSocket()) {
  app.listen(systemdSocket());
} else {
  app.listen(8001, '127.0.0.1');
}

app.get('/', function(req, res) {
  res.send('Hi. Please go away. Thanks.');
});

app.use('/public', Express.static(__dirname + '/public', { maxAge: '1 year' }));

app.use(function(req, res, next) {
  if (!user.steamID) {
    res.set('Cache-Control', 'public, max-age=0');
    res.redirect('/public/default.jpg');
  } else {
    next();
  }
});

var appIconCache = [];
app.get('/app/:app/icon.jpg', function(req, res) {
  var appId = parseInt(req.params.app, 10);
  if (isNaN(appId)) {
    res.set('Cache-Control', 'public, max-age=31557600');
    res.redirect('/public/default.jpg');
    return;
  }

  var isSecure = (req.headers['x-forwarded-proto'] === 'https');
  var cacheKey = (appId + '-' + isSecure);

  if (appIconCache[cacheKey]) {
    res.set('Cache-Control', 'public, max-age=31557600');
    res.redirect(appIconCache[cacheKey]);
    return;
  }

  var apps = [];
  apps[0] = appId;

  user.getProductInfo(apps, [], function(err, appData, packageData, unknownApps, unknownPackages) {
    if (err || unknownApps[0] == appId) {
      res.set('Cache-Control', 'public, max-age=86400');
      res.redirect('/public/default.jpg');
      return;
    }

    var appData = appData[appId];
    var imageHash = appData && appData.appinfo && appData.appinfo.common && appData.appinfo.common.icon;
    if (!imageHash) {
      res.set('Cache-Control', 'public, max-age=86400');
      res.redirect('/public/default.jpg');
      return;
    }

    var imageUrl = '/steamcommunity/public/images/apps/'+appId+'/'+imageHash+'.jpg';

    if (isSecure) {
      imageUrl = 'https://steamcdn-a.akamaihd.net' + imageUrl;
    } else {
      imageUrl = 'http://cdn.akamai.steamstatic.com' + imageUrl;
    }

    appIconCache[cacheKey] = imageUrl;

    console.log('Cached URL for '+cacheKey+': '+imageUrl);

    res.set('Cache-Control', 'public, max-age=31557600');
    res.redirect(imageUrl);
  });
});

var avatarIconCache = [];
app.get('/user/:user/icon.jpg', function(req, res) {
  var accountId = parseInt(req.params.user, 10);
  if (isNaN(accountId)) {
    res.set('Cache-Control', 'public, max-age=31557600');
    res.redirect('/public/default.jpg');
    return;
  }

  var isSecure = (req.headers['x-forwarded-proto'] === 'https');
  var cacheKey = (accountId + '-' + isSecure);

  if (avatarIconCache[cacheKey]) {
    res.set('Cache-Control', 'public, max-age=31557600');
    res.redirect(avatarIconCache[cacheKey]);
    return;
  }

  request('http://steamcommunity.com/profiles/[U:1:'+accountId+']/?xml=1', function(error, response, body) {
    if (error || response.statusCode != 200) {
      res.set('Cache-Control', 'public, max-age=86400');
      res.redirect('/public/default.jpg');
      return;
    }

    parseXml(body, function(err, result) {
      if (err) {
        res.set('Cache-Control', 'public, max-age=86400');
        res.redirect('/public/default.jpg');
        return;
      }

      var imageUrl = result && result.profile && result.profile.avatarIcon && result.profile.avatarIcon[0];
      if (!imageUrl) {
        res.set('Cache-Control', 'public, max-age=86400');
        res.redirect('/public/default.jpg');
        return;
      }

      if (isSecure) {
        imageUrl = imageUrl.replace('http://cdn.akamai.steamstatic.com/', 'https://steamcdn-a.akamaihd.net/');
      }

      avatarIconCache[cacheKey] = imageUrl;

      console.log('Cached URL for '+cacheKey+': '+imageUrl);

      res.set('Cache-Control', 'public, max-age=31557600');
      res.redirect(imageUrl);
    });
  });
});
