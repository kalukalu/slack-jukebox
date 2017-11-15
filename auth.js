const Url           = require('url');
const Readline      = require('readline');
const Querystring   = require('querystring');
const SpotifyWebApi = require('spotify-web-api-node');

var spotifyApi = new SpotifyWebApi({
  redirectUri : process.env.SPOTIFY_REDIRECT_URI,
  clientId : process.env.SPOTIFY_CLIENT_ID
});

var authorizeURL = spotifyApi.createAuthorizeURL(
  ['playlist-read-collaborative','playlist-modify-private'], 
  'slack-jukebox-init'
);

console.log('\nOpen the following URL in your browser to authenticate the app:');
console.log(authorizeURL);

const rl = Readline.createInterface({ 
  input: process.stdin, 
  output: process.stdout 
});

rl.question('\nCopy and paste the full URL you were redirected to:\n', (data) => {
  var queryStr = Url.parse(data, true).search;
  var queryVars = Querystring.parse(queryStr.substring(1));
  console.log(`\nYour Spotify Authorization Code:\n${queryVars.code}`);

  rl.close();
});  