require('dotenv').config();
var Turn = require('node-turn');

const turnUsername = process.env.TURN_USERNAME || "000000002086321408";
const turnPassword = process.env.TURN_PASSWORD || "7D3h0/OgoI8Eql3n4d4WB9bs0Cg=";

var server = new Turn({
  // Set options
  listeningPort: 3480,
  listeningIps: ['0.0.0.0'],
  authMech: 'long-term',
  credentials: {
    [turnUsername]: turnPassword,
  }
});

console.log("TURN server is starting...");
server.on('error', (error) => {
  console.error("TURN server encountered an error:", error);
});

server.start();
console.log("TURN server started on port 3480.");
