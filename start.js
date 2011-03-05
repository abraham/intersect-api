require.paths.unshift('/usr/local/lib/node');

var sys = require('sys'),
    twitter = require('twitter'),
    http = require('http');

http.createServer(function (request, result) {
  res = result;
  var options = require('url').parse(request.url, true);
  if (options && options.query && options.query.screen_name) {
    init(options.query.screen_name.split(','));
  } else {
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end('{"error":"Not found"}');
  }
}).listen(8124, "127.0.0.1");

var userA = { friends: [], followers: [], screenName: null },
    userB = { friends: [], followers: [], screenName: null },
    commonFriends = [],
    commonFollowers = [],
    userAFriendsFollowingUserB = [],
    userBFriendsFollowingUserA = [],
    complete = 0,
    ids = [],
    profiles = [],
    active = 0
    results = {},
    res = false;

var twit = new twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: ''
});

function init(options) {
  getIds({
    screenName: options[0],
    path: 'friends',
    user: userA
  });
  getIds({
    screenName: options[0],
    path: 'followers',
    user: userA
  });
  getIds({
    screenName: options[1],
    path: 'friends',
    user: userB
  });
  getIds({
    screenName: options[1],
    path: 'followers',
    user: userB
  });
}

function getIds(options) {
  twit.get('/' + options.path + '/ids.json', { screen_name: options.screenName }, function(data){
    complete++;
    if (data.statusCode === undefined && Array.isArray(data)) {
      options.user[options.path] = data;
      options.user.screenName = options.screenName;
      compute();
    }
  });
}

function compute(options) {
  if (complete === 4) {
    var temp = [];
    commonFriends = userA.friends.filter(function (element, index, array) {
      return userB.friends.indexOf(element) > -1;
    });
    commonFollowers = userA.followers.filter(function (element, index, array) {
      return userB.followers.indexOf(element) > -1;
    });
    userAFriendsFollowingUserB = userA.friends.filter(function (element, index, array) {
      return userB.followers.indexOf(element) > -1;
    });
    userBFriendsFollowingUserA = userA.followers.filter(function (element, index, array) {
      return userB.friends.indexOf(element) > -1;
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
    completeLookup({ data: data });
  });
}

function completeLookup(options) {
    profiles = profiles.concat(options.data);

  if (active === 0) {
    buildJson();
  }
}

function buildJson() {
  results.common_friends = [];
  results.common_followers = [];
  results[userA.screenName + '_friends_following_' + userB.screenName] = [];
  results[userB.screenName + '_friends_following_' + userA.screenName] = [];
  commonFriends.forEach(function(element, index, array) {
    results.common_friends.push(profiles.filter(function(element, index, array) {
      return element.id_str == this.id;
    }, { id: element }));
  });
  commonFollowers.forEach(function(element, index, array) {
    results.common_followers.push(profiles.filter(function(element, index, array) {
      return element.id_str == this.id;
    }, { id: element }));
  });
  userAFriendsFollowingUserB.forEach(function(element, index, array) {
    results[userA.screenName + '_friends_following_' + userB.screenName].push(profiles.filter(function(element, index, array) {
      return element.id_str == this.id;
    }, { id: element }));
  });
  userBFriendsFollowingUserA.forEach(function(element, index, array) {
    results[userB.screenName + '_friends_following_' + userA.screenName].push(profiles.filter(function(element, index, array) {
      return element.id_str == this.id;
    }, { id: element }));
  });
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(results));
  
}