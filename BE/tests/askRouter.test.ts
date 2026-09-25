import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Ask does not use the regex router to skip the model', () => {
    const source = fs.readFileSync(path.join(__dirname, '../controllers/ask.controller.ts'), 'utf8');
    assert.equal(source.includes('routeAsk'), false);
    assert.equal(source.includes('askRouter'), false);
    assert.equal(source.includes('isGreeting'), false);
    assert.equal(source.includes('isInstructionShaped'), false);
    assert.equal(source.includes('isStopWordOnly'), false);
});
