// var Turn = require('node-turn');
// var server = new Turn({
//   // Set options
//   listeningPort: 3478,
//   authMech: 'long-term',
//   credentials: {
//     "efA389S6BJFSNKYQP2": "dkvSztjG5Rs60Er0", // Updated username and password
//   }
// });
//
// console.log("TURN server is starting...");
// server.on('error', (error) => {
//   console.error("TURN server encountered an error:", error);
// });
// server.start();
// console.log("TURN server started on port 3478.");

// turn.js
var Turn = require('node-turn');

// Create a new TURN server instance
var server = new Turn({
  // List of listening IP addresses. We use your public IP:
  listeningIps: ["157.245.122.124"],

  // Optional: specify relay IP addresses for relaying media (same public IP).
  relayIps: ["157.245.122.124"],

  // The TURN listening port:
  listeningPort: 3478,

  // Authorization mechanism (use 'long-term' for username/password).
  authMech: 'long-term',

  // Your TURN credentials (username/password pairs):
  credentials: {
    "efA389S6BJFSNKYQP2": "dkvSztjG5Rs60Er0"
  }
});

// Log startup messages
console.log("TURN server is starting...");

// Catch any server errors
server.on('error', (error) => {
  console.error("TURN server encountered an error:", error);
});

// Start the server
server.start();
console.log("TURN server started on port 3478.");

