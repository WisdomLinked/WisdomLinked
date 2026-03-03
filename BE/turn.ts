var Turn = require('node-turn');
var server = new Turn({
  // Set options
  listeningPort: 3480,
  listeningIps: ['0.0.0.0'],
  authMech: 'long-term',
  credentials: {
    "000000002086321408": "7D3h0/OgoI8Eql3n4d4WB9bs0Cg=", // Updated username and password
  }
});

console.log("TURN server is starting...");
server.on('error', (error) => {
  console.error("TURN server encountered an error:", error);
});

server.start();
console.log("TURN server started on port 3480.");
