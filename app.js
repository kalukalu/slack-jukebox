const SpotifyWebApi = require('spotify-web-api-node');
const SlackRtmClient = require('@slack/client').RtmClient;
const SlackRtmEvents = require('@slack/client').RTM_EVENTS;
const SlackClientEvents = require('@slack/client').CLIENT_EVENTS;

var tokenSecondsRemaining = -1;
var tokenRefreshThreshold = 200;

var spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// start listening for new tracks in slack channel
var startTrackListener = function() {
  var spotifyUserName = process.env.SPOTIFY_USER_NAME;
  var spotifyPlaylistId = process.env.SPOTIFY_PLAYLIST_ID;
  var spotifyTrackMatcher = /\<https\:\/\/open.spotify.com\/track\/(.*?\>)/g;
  
  var slackRtm = new SlackRtmClient(process.env.SLACK_BOT_TOKEN);
  slackRtm.start();

  // listen and log sign in event
  slackRtm.on(SlackClientEvents.RTM.AUTHENTICATED, function (startData) {
    console.log(`Signed in as ${startData.self.name} on team ${startData.team.name}`);
  });

  // listen for track links then add to playlist
  slackRtm.on(SlackRtmEvents.MESSAGE, function handleRtmMessage(message) {    
    if (message['hidden'] === 'true') { return; }
    
    while(matches = spotifyTrackMatcher.exec(message['text'])) {
      var trackId = matches[1].slice(0, -1);
      
      // ensure we can get the track
      spotifyApi.getTrack(trackId).then(function(trackData) {
        var title = trackData.body['name'];
        var artist = trackData.body['artists'].map(function(a) { return a['name']; }).join();
        var trackUri = `spotify:track:${trackId}`;
        
        spotifyApi.addTracksToPlaylist(spotifyUserName, spotifyPlaylistId, [trackUri], {position: 0})
          .then(function(data) {
            var msg = `Added '${title}' by ${artist} to the team playlist!`;
            slackRtm.sendMessage(msg, message.channel);
            console.log(msg);
          }, function(err) {
            console.log('Error adding track to playlist: ', err);
          });              
      }, function(err) {
        console.log('Error finding track: ' + trackId, err);
      });  
    };
  });  
};

// handle token update
var updateTokens = function(data) {
  tokenSecondsRemaining = data.body['expires_in'];
  console.log(`Tokens refreshed - expires in ${tokenSecondsRemaining} seconds.`);

  if (data.body['access_token']) {
    spotifyApi.setAccessToken(data.body['access_token']);  
  }

  if (data.body['refresh_token']) {
    spotifyApi.setRefreshToken(data.body['refresh_token']);
  }
};

// auth request for access and refresh tokens
spotifyApi.authorizationCodeGrant(process.env.SPOTIFY_AUTH_CODE)
  .then(function(data) {
    updateTokens(data);    
    startTrackListener();    
  }, function(err) {
    console.log('Error retrieving the access token!', err.message);
  });  

// ticker to handle token refresh
setInterval(function() {
  if (tokenSecondsRemaining === -1) { return; }
  
  if (tokenSecondsRemaining % 10 === 0) {
    console.log('Token auth time remaining:', tokenSecondsRemaining);
  }
  
  if (--tokenSecondsRemaining > tokenRefreshThreshold) {
    return; 
  } 

  tokenSecondsRemaining = -1;
  spotifyApi.refreshAccessToken()
    .then(function(data) {
      updateTokens(data);
    }, function(err) {
      console.log('Error refreshing tokens!', err.message);
    });
}, 1000);
