var Turn = require('node-turn');
var server = new Turn({
  // Set options
  listeningPort: 3478,
  listeningIps: ['0.0.0.0'],
  authMech: 'long-term',
  credentials: {
    "efRXSXFPE63R9RIO40": "mfC08YbrsCacihuc", // Updated username and password
  }
});

console.log("TURN server is starting...");
server.on('error', (error) => {
  console.error("TURN server encountered an error:", error);
});

server.start();
console.log("TURN server started on port 3478.");