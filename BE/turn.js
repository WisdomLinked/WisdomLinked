var Turn = require('node-turn');
var server = new Turn({
  // set options
 // listeningIp: '0.0.0.0',
  listeningPort: 3478,
 // relayIps: '0.0.0.0',
  authMech: 'long-term',
  credentials: {
    username: "password"
  }
});

server.start()
