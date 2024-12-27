// var Turn = require('node-turn');
// var server = new Turn({
//   // set options
//  // listeningIp: '0.0.0.0',
//   listeningPort: 3478,
//  // relayIps: '0.0.0.0',
//   authMech: 'long-term',
//   credentials: {
//     username: "password"
//   }
// });
//
// console.log("TURN server is starting...");
// server.on('error', (error) => {
//   console.error("TURN server encountered an error:", error);
// });
// server.start();
// console.log("TURN server started on port 3478.");

var Turn = require('node-turn');
var server = new Turn({
  // Set options
  listeningPort: 3478,
  authMech: 'long-term',
  credentials: {
    "efA389S6BJFSNKYQP2": "dkvSztjG5Rs60Er0", // Updated username and password
  }
});

console.log("TURN server is starting...");
server.on('error', (error) => {
  console.error("TURN server encountered an error:", error);
});
server.start();
console.log("TURN server started on port 3478.");
