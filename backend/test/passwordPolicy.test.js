'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { passwordProblem } = require('../src/common/passwordPolicy');

test('hợp lệ: ≥ 8 ký tự, có chữ và số', () => {
  for (const pw of ['password123', 'Abcdefg1', 'mậtkhẩu99', 'a'.repeat(71) + '1']) assert.equal(passwordProblem(pw), null, pw);
});

test('không hợp lệ: ngắn, thiếu số, thiếu chữ, quá 72 byte, sai kiểu', () => {
  assert.match(passwordProblem('abc1'), /ít nhất 8/);
  assert.match(passwordProblem('chiconchu'), /chữ và số/);
  assert.match(passwordProblem('12345678'), /chữ và số/);
  assert.match(passwordProblem('a1'.repeat(37)), /72 byte/);
  assert.match(passwordProblem('ậ'.repeat(30) + '1'), /72 byte/); // chữ có dấu chiếm nhiều byte
  assert.match(passwordProblem(undefined), /ít nhất 8/);
  assert.match(passwordProblem(12345678), /ít nhất 8/);
});
