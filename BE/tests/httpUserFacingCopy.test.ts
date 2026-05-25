import test from 'node:test';
import assert from 'node:assert/strict';
import { HTTP_GENERIC_ERROR, safeErrorMessage } from '../utils/httpUserFacingCopy';

test('safeErrorMessage always returns generic copy', () => {
    assert.equal(safeErrorMessage(new Error('Mongo timeout')), HTTP_GENERIC_ERROR);
    assert.equal(safeErrorMessage('internal'), HTTP_GENERIC_ERROR);
});
