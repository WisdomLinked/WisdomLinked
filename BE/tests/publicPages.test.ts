import test from 'node:test';
import assert from 'node:assert/strict';

const { searchPublicPages } = require('../search/publicPages');

test('searchPublicPages loads from the shared public page index', () => {
    assert.equal(typeof searchPublicPages, 'function');
    assert.deepEqual(searchPublicPages('a'), []);
    assert.deepEqual(searchPublicPages('  x '), []);

    const rows = searchPublicPages('Guidelines');
    assert.ok(rows.length >= 1);
    for (const row of rows) {
        assert.deepEqual(Object.keys(row).sort(), ['route', 'snippet', 'title']);
        assert.equal(['/', '/aboutus', '/services', '/rules', '/contactus'].includes(row.route), true);
    }
    assert.equal(rows.some((row: any) => row.route === '/' && row.title.includes('Guidelines for Quality')), true);
    assert.equal(searchPublicPages('Student sign up').length, 0);
    assert.equal(searchPublicPages('Lorem ipsum').length, 0);
});
