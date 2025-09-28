require('dotenv').config();
const Turn = require('node-turn');

// Env configuration with sensible defaults
const PORT = parseInt(process.env.TURN_PORT || '3478', 10);
const LISTEN_IPS = (process.env.TURN_LISTEN_IPS || '0.0.0.0')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const REALM = process.env.TURN_REALM || 'wisdomlinked';
const USERNAME = process.env.TURN_USERNAME || 'efRXSXFPE63R9RIO40';
const PASSWORD = process.env.TURN_PASSWORD || 'mfC08YbrsCacihuc';
const PUBLIC_IP = process.env.TURN_PUBLIC_IP; // optional: public IP for relays
const MIN_PORT = process.env.TURN_MIN_PORT ? parseInt(process.env.TURN_MIN_PORT, 10) : undefined; // e.g. 49160
const MAX_PORT = process.env.TURN_MAX_PORT ? parseInt(process.env.TURN_MAX_PORT, 10) : undefined; // e.g. 49200

const options = {
  listeningPort: PORT,
  listeningIps: LISTEN_IPS,
  authMech: 'long-term',
  realm: REALM,
  credentials: { [USERNAME]: PASSWORD },
};

if (PUBLIC_IP) {
  options.relayIps = [PUBLIC_IP];
}
if (MIN_PORT && MAX_PORT) {
  options.minPort = MIN_PORT;
  options.maxPort = MAX_PORT;
}

const server = new Turn(options);

console.log(`TURN server is starting on ${LISTEN_IPS.join(',')} port ${PORT}...`);
server.on('error', (error) => {
  console.error('TURN server encountered an error:', error);
});

server.start();
console.log(`TURN server started. realm=${REALM} username=${USERNAME} port=${PORT}`);
