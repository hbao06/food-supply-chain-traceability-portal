'use strict';

const bcrypt = require('bcryptjs');

// bcryptjs cho ra "$2a$10$..." dài 60 ký tự, khớp CHECK chk_users_password_is_bcrypt.
function createHasher({ cost = 10 } = {}) {
  return {
    hash: (plain) => bcrypt.hash(plain, cost),
    compare: (plain, hash) => bcrypt.compare(plain, hash),
  };
}

module.exports = { createHasher };
