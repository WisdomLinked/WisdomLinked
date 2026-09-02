import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
const { parseMultipartFields } = require('../middlewares/multerConfig');

function listenWithRoleParser(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      parseMultipartFields(req, res, (err: unknown) => {
        if (err) {
          res.statusCode = 500;
          res.end(String(err));
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            role: typeof (req as any).body?.role === 'string' ? (req as any).body.role : null,
          }),
        );
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('failed to bind test server'));
        return;
      }
      resolve({ server, port: addr.port });
    });
  });
}

test('parseMultipartFields parses role from multipart PUT body for oauth-role', async () => {
  const { server, port } = await listenWithRoleParser();
  try {
    const formData = new FormData();
    formData.append('role', 'expert');
    const response = await fetch(`http://127.0.0.1:${port}/oauth-role`, {
      method: 'PUT',
      body: formData,
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.role, 'expert');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('parseMultipartFields returns null role when field missing', async () => {
  const { server, port } = await listenWithRoleParser();
  try {
    const formData = new FormData();
    const response = await fetch(`http://127.0.0.1:${port}/oauth-role`, {
      method: 'PUT',
      body: formData,
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.role, null);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
