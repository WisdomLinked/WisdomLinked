import test from 'node:test';
import assert from 'node:assert/strict';
import { HTTP_GENERIC_ERROR, safeErrorMessage, safeHttp500Message } from '../utils/httpUserFacingCopy';

test('safeErrorMessage always returns generic copy', () => {
    assert.equal(safeErrorMessage(new Error('Mongo timeout')), HTTP_GENERIC_ERROR);
    assert.equal(safeErrorMessage('internal'), HTTP_GENERIC_ERROR);
});

test('safeHttp500Message returns booking validation copy', () => {
    assert.match(
        safeHttp500Message(new Error('Selected time is outside expert availability')),
        /outside expert availability/i
    );
    assert.equal(safeHttp500Message(new Error('Mongo timeout')), HTTP_GENERIC_ERROR);
});
