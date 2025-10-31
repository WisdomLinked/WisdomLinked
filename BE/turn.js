var Turn = require('node-turn');
var server = new Turn({
  // Set options
  listeningPort: 3480,
  listeningIps: ['0.0.0.0'],
  authMech: 'long-term',
  credentials: {
    "000000002077044058": "Yg0YtBV+8QIW0Jw8ZfNVz961Mk0=", // Updated username and password
  }
});

console.log("TURN server is starting...");
server.on('error', (error) => {
  console.error("TURN server encountered an error:", error);
});

server.start();
console.log("TURN server started on port 3480.");