require.paths.unshift('/usr/local/lib/node');

var sys = require('sys'),
    twitter = require('twitter'),
    http = require('http'),
    config = require('./config').config;

http.createServer(function (request, result) {
  var options = require('url').parse(request.url, true);
  res = result;
  if (!options.pathname || options.pathname !== '/intersect.json') {
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end('{"error":"Unknown API method"}');
  } else if (request.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json', 'Allow': 'GET' });
    res.end('{"error":"Requires HTTP method: GET"}');
  } else if (options.query && !options.query.screen_name) {
    res.writeHead(400, {'Content-Type': 'application/json'});
    res.end('{"error":"Missing required parameter: screen_name"}');
  } else if (options.query.screen_name.split(',').length !== 2) {
    res.writeHead(400, {'Content-Type': 'application/json'});
    res.end('{"error":"Invalad parameter value: screen_name"}');
  } else {
    init({ users: options.query.screen_name.split(',') });
  }
}).listen(8743);

var users = [
      { friends: [], followers: [], screenName: null },
      { friends: [], followers: [], screenName: null }
    ],
    commonFriends = [],
    commonFollowers = [],
    userAFriendsFollowingUserB = [],
    userBFriendsFollowingUserA = [],
    complete = 0,
    ids = [],
    profiles = [],
    active = 0
    res = false;

var twit = new twitter({
  consumer_key: config.twitter.consumer_key,
  consumer_secret: config.twitter.consumer_secret,
  access_token_key: config.twitter.access_token_key,
  access_token_secret: config.twitter.access_token_secret
});

function init(options) {
  options.users.forEach(function (element, index, array) {
    ['friends', 'followers'].forEach(function (element, index, array) {
      getIds({
        user: this.user,
        path: element,
        userIndex: this.userIndex
      });
    }, { user: element, userIndex: index });
  });
}

function getIds(options) {
  twit.get('/' + options.path + '/ids.json', {
    screen_name: options.user
  }, function(data){
    complete++;
    if (data.statusCode === undefined && Array.isArray(data)) {
      users[options.userIndex][options.path] = data;
      users[options.userIndex].screenName = options.user;
      compute();
    }
  });
}

function compute(options) {
  if (complete === 4) {
    var temp = [];
    commonFriends = users[0].friends.filter(function (element, index, array) {
      return users[1].friends.indexOf(element) > -1;
    });
    commonFollowers = users[0].followers.filter(function (element, index, array) {
      return users[1].followers.indexOf(element) > -1;
    });
    userAFriendsFollowingUserB = users[0].friends.filter(function (element, index, array) {
      return users[1].followers.indexOf(element) > -1;
    });
    userBFriendsFollowingUserA = users[0].followers.filter(function (element, index, array) {
      return users[1].friends.indexOf(element) > -1;
    });
    temp = commonFriends.concat(commonFollowers, userAFriendsFollowingUserB, userBFriendsFollowingUserA);

    temp.forEach(function (element, index, array) {
      if (ids.indexOf(element) === -1) {
        ids.push(element);
      }
    });

    while (ids.length > 0) {
      lookupUsers({ userIds: ids.splice(0, 100).join(',') });
      active++;
    }
  }
}

function lookupUsers(options) {
  twit.get('/users/lookup.json', { user_id: options.userIds }, function(data){
    active--;
    if (data.statusCode === undefined && Array.isArray(data)) {
      completeLookup({ data: data });
    } else {
      completeLookup({ data: [] });
    }
  });
}

function completeLookup(options) {
  profiles = profiles.concat(options.data);
  if (active === 0) {
    buildJson();
  }
}

function buildJson() {
  var results = {
    common_friends: [],
    common_followers: []
  };
  results[users[0].screenName + '_friends_following_' + users[1].screenName] = [];
  results[users[1].screenName + '_friends_following_' + users[0].screenName] = [];

  [
    {
      list: commonFriends,
      name: 'common_friends'
    },
    {
      list: commonFollowers,
      name: 'common_followers'
    },
    {
      list: userAFriendsFollowingUserB,
      name: users[0].screenName + '_friends_following_' + users[1].screenName
    },
    {
      list: userBFriendsFollowingUserA,
      name: users[1].screenName + '_friends_following_' + users[0].screenName
    }
  ].forEach(function (element, index, array) {
    element.list.forEach(function(element, index, array) {
      var profile = profiles.filter(function(element, index, array) {
        return element.id_str == this.id;
      }, { id: element })
      if (profile.length) {
        results[this.name].push(profile[0]);
      }
    }, { name: element.name });
  });

  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(results));
}