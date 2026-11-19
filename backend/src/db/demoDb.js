'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { ORGS, USERS, PRODUCTS, BATCHES, createSeedQr } = require('./seedDemo');

const GENESIS_HASH = '0'.repeat(64);
const EVENT_ORDER = ['CREATED', 'TRANSPORTED', 'RECEIVED', 'PROCESSED', 'PACKAGED', 'SHIPPED'];
const DEFAULT_DB_FILE = path.resolve(__dirname, '../../data/demo-db.json');

function sha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function computeAuditHash(prevHash, row) {
  const payload = JSON.stringify([
    prevHash,
    row.chain_seq,
    row.actor_id,
    row.action,
    row.entity_type,
    row.entity_id,
    row.old_value ?? null,
    row.new_value ?? null,
    row.created_at,
  ]);
  return sha256(payload);
}

function computeEventHash(prevHash, row) {
  const payload = JSON.stringify([
    prevHash,
    row.chain_seq,
    row.batch_id,
    row.actor_id,
    row.event_type,
    row.timestamp,
    row.location,
    row.description ?? null,
  ]);
  return sha256(payload);
}

function createInitialState({ secret, baseUrl, password }) {
  const qr = createSeedQr({ secret, baseUrl });
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;

  const state = {
    meta: {
      seededAt: now.toISOString(),
      traceBaseUrl: baseUrl,
      prefix: 'FR-',
    },
    seq: {
      organizations: 0,
      users: 0,
      products: 0,
      batches: 0,
      qr_codes: 0,
      supply_chain_events: 0,
      audit_logs: 0,
    },
    organizations: [],
    users: [],
    products: [],
    batches: [],
    qr_codes: [],
    supply_chain_events: [],
    audit_logs: [],
  };

  function pushAudit({ actorId, action, entityType, entityId, oldValue = null, newValue = null, createdAt }) {
    const id = ++state.seq.audit_logs;
    const prevHash = state.audit_logs.length ? state.audit_logs[state.audit_logs.length - 1].row_hash : GENESIS_HASH;
    const row = {
      audit_id: id,
      actor_id: actorId ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      old_value: oldValue,
      new_value: newValue,
      created_at: createdAt || new Date().toISOString(),
      chain_seq: id,
      prev_hash: prevHash,
      row_hash: '',
    };
    row.row_hash = computeAuditHash(prevHash, row);
    state.audit_logs.push(row);
    return row;
  }

  function pushEvent({ batchId, actorId, eventType, location, description = null, timestamp }) {
    const id = ++state.seq.supply_chain_events;
    const batchEvents = state.supply_chain_events.filter((e) => e.batch_id === batchId);
    const chainSeq = batchEvents.length + 1;
    const prevHash = batchEvents.length ? batchEvents[batchEvents.length - 1].row_hash : GENESIS_HASH;
    const row = {
      event_id: id,
      batch_id: batchId,
      actor_id: actorId,
      event_type: eventType,
      timestamp: timestamp || new Date().toISOString(),
      location,
      description,
      chain_seq: chainSeq,
      prev_hash: prevHash,
      row_hash: '',
    };
    row.row_hash = computeEventHash(prevHash, row);
    state.supply_chain_events.push(row);
    const batch = state.batches.find((b) => b.batch_id === batchId);
    if (batch) batch.current_status = eventType;
    return row;
  }

  const orgIdMap = {};
  for (const o of ORGS) {
    const id = ++state.seq.organizations;
    const createdAt = new Date(now.getTime() - 30 * DAY + id * 1000).toISOString();
    state.organizations.push({
      organization_id: id,
      name: o.name,
      type: o.type,
      address: o.address ?? null,
      created_at: createdAt,
    });
    orgIdMap[o.key] = id;
    pushAudit({ actorId: null, action: 'CREATE', entityType: 'ORGANIZATION', entityId: id, newValue: { name: o.name, type: o.type, source: 'seed' }, createdAt });
  }

  const userIdMap = {};
  for (const u of USERS) {
    const id = ++state.seq.users;
    const createdAt = new Date(now.getTime() - 25 * DAY + id * 1000).toISOString();
    state.users.push({
      user_id: id,
      name: u.name,
      email: u.email,
      password_hash: passwordHash,
      role: u.role,
      status: u.status,
      organization_id: u.org ? orgIdMap[u.org] : null,
      created_at: createdAt,
    });
    userIdMap[u.key] = id;
    pushAudit({ actorId: null, action: 'CREATE', entityType: 'USER', entityId: id, newValue: { name: u.name, role: u.role, status: u.status, source: 'seed' }, createdAt });
  }

  const productIdMap = {};
  const productNameMap = {};
  for (const p of PRODUCTS) {
    const id = ++state.seq.products;
    state.products.push({
      product_id: id,
      organization_id: orgIdMap[p.org],
      name: p.name,
      category: p.category,
      unit: p.unit,
      description: p.description,
    });
    productIdMap[p.key] = id;
    productNameMap[p.key] = p.name;
  }

  for (const b of BATCHES) {
    const farmer = USERS.find((u) => u.key === b.farmer);
    const createdAt = new Date(now.getTime() - b.days * DAY);
    const batchId = ++state.seq.batches;
    const batchRow = {
      batch_id: batchId,
      batch_code: b.code,
      product_id: productIdMap[b.product],
      product_name: productNameMap[b.product],
      origin: b.origin,
      quantity: Number(b.quantity).toFixed(2),
      creation_date: createdAt.toISOString(),
      current_status: 'CREATED',
      created_by: userIdMap[b.farmer],
      organization_id: orgIdMap[farmer.org],
    };
    state.batches.push(batchRow);
    pushAudit({
      actorId: userIdMap[b.farmer],
      action: 'CREATE',
      entityType: 'BATCH',
      entityId: batchId,
      newValue: { batchCode: b.code, quantity: b.quantity, source: 'seed' },
      createdAt: createdAt.toISOString(),
    });

    const qrId = ++state.seq.qr_codes;
    state.qr_codes.push({
      qr_id: qrId,
      batch_id: batchId,
      qr_data: qr.url(b.code),
      signature_hmac: qr.signature(b.code),
      created_at: createdAt.toISOString(),
    });
    pushAudit({
      actorId: userIdMap[b.farmer],
      action: 'CREATE',
      entityType: 'QR_CODE',
      entityId: qrId,
      newValue: { batchId, source: 'seed' },
      createdAt: createdAt.toISOString(),
    });

    const events = [['CREATED', b.farmer, b.origin, 'Thu hoạch, khởi tạo lô và dán mã định danh']].concat(b.steps);
    for (let i = 0; i < events.length; i++) {
      const [type, actorKey, location, description] = events[i];
      const at = new Date(createdAt.getTime() + i * DAY).toISOString();
      const ev = pushEvent({
        batchId,
        actorId: userIdMap[actorKey],
        eventType: type,
        location,
        description,
        timestamp: at,
      });
      pushAudit({
        actorId: userIdMap[actorKey],
        action: 'CREATE',
        entityType: 'EVENT',
        entityId: ev.event_id,
        newValue: { batchId, batchCode: b.code, eventType: type, source: 'seed' },
        createdAt: at,
      });
    }
  }

  return state;
}

function ilikeMatch(text, pattern) {
  if (text == null) return false;
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\\([%_])/g, '$1')
    .replace(/%/g, '.*')
    .replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(String(text));
}

function makePgError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function createDemoDb({
  filePath = DEFAULT_DB_FILE,
  secret = process.env.QR_HMAC_SECRET || 'demo-fixed-qr-hmac-secret-key-2026-food-traceability-portal',
  baseUrl = process.env.TRACE_BASE_URL || 'http://localhost:5173',
  password = process.env.SEED_USER_PASSWORD || 'Demo12345',
} = {}) {
  let state = null;
  let txDepth = 0;
  let txSnapshot = null;

  function saveState() {
    if (txDepth > 0) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  function loadOrInit(forceReset = false) {
    if (!forceReset && fs.existsSync(filePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed && parsed.meta && parsed.meta.prefix === 'FR-' && Array.isArray(parsed.batches) && parsed.batches.length > 0) {
          // Ensure QR URLs match current QR_HMAC_SECRET & TRACE_BASE_URL so scanning always verifies cleanly!
          const qr = createSeedQr({ secret, baseUrl });
          for (const q of parsed.qr_codes) {
            const b = parsed.batches.find((item) => item.batch_id === q.batch_id);
            if (b) {
              q.qr_data = qr.url(b.batch_code);
              q.signature_hmac = qr.signature(b.batch_code);
            }
          }
          state = parsed;
          return state;
        }
      } catch (_) {
        // Recreate corrupted file
      }
    }
    state = createInitialState({ secret, baseUrl, password });
    saveState();
    return state;
  }

  loadOrInit(false);

  const orgById = (id) => state.organizations.find((o) => Number(o.organization_id) === Number(id)) || null;
  const userById = (id) => state.users.find((u) => Number(u.user_id) === Number(id)) || null;

  function enrichUser(u) {
    const org = u.organization_id != null ? orgById(u.organization_id) : null;
    return {
      ...u,
      organization_name: org ? org.name : null,
      organization_type: org ? org.type : null,
    };
  }

  function enrichEvent(e) {
    const u = userById(e.actor_id);
    const org = u && u.organization_id != null ? orgById(u.organization_id) : null;
    return {
      ...e,
      actor_name: u ? u.name : null,
      organization_name: org ? org.name : null,
    };
  }

  function matchesBatchScope(sql, params, batch) {
    if (/\bFALSE\b/.test(sql) && !/WHERE\s+b\.batch_id\s*=\s*\$1\s+AND\s+TRUE/.test(sql) && /AND\s+FALSE\b|WHERE\s+FALSE\b/.test(sql)) {
      return false;
    }
    if (/WHERE\s+TRUE\b|AND\s+TRUE\b/.test(sql)) {
      return true;
    }
    const orgMatch = sql.match(/b\.organization_id\s*=\s*\$(\d+)/);
    if (orgMatch) {
      const orgId = Number(params[Number(orgMatch[1]) - 1]);
      return Number(batch.organization_id) === orgId;
    }
    const existsMatch = sql.match(/scope_u\.organization_id\s*=\s*\$(\d+)/);
    if (existsMatch) {
      const orgId = Number(params[Number(existsMatch[1]) - 1]);
      const handled = state.supply_chain_events.some((ev) => {
        if (Number(ev.batch_id) !== Number(batch.batch_id)) return false;
        const actor = userById(ev.actor_id);
        return actor && Number(actor.organization_id) === orgId;
      });
      const awaitingMatch = sql.match(/OR\s+b\.current_status\s*=\s*ANY\(\$(\d+)::text\[\]\)/);
      if (awaitingMatch) {
        const statuses = params[Number(awaitingMatch[1]) - 1] || [];
        return handled || statuses.includes(batch.current_status);
      }
      return handled;
    }
    return true;
  }

  function filterBatches(sql, params) {
    return state.batches.filter((b) => {
      if (!matchesBatchScope(sql, params, b)) return false;

      const andAwaiting = sql.match(/AND\s+b\.current_status\s*=\s*ANY\(\$(\d+)::text\[\]\)/);
      if (andAwaiting) {
        const statuses = params[Number(andAwaiting[1]) - 1] || [];
        if (!statuses.includes(b.current_status)) return false;
      }

      const statusMatch = sql.match(/b\.current_status\s*=\s*\$(\d+)/);
      if (statusMatch) {
        if (b.current_status !== params[Number(statusMatch[1]) - 1]) return false;
      }

      const exactCodeMatch = sql.match(/\(b\.batch_code\s*=\s*\$(\d+)\s+OR\s+b\.product_name\s+ILIKE\s+\$(\d+)\)/);
      if (exactCodeMatch) {
        const code = params[Number(exactCodeMatch[1]) - 1];
        const likePat = params[Number(exactCodeMatch[2]) - 1];
        if (b.batch_code !== code && !ilikeMatch(b.product_name, likePat)) return false;
      } else {
        const likeMatch = sql.match(/\(b\.product_name\s+ILIKE\s+\$(\d+)\s+OR\s+b\.batch_code\s+ILIKE\s+\$(\d+)\)/);
        if (likeMatch) {
          const pat = params[Number(likeMatch[1]) - 1];
          if (!ilikeMatch(b.product_name, pat) && !ilikeMatch(b.batch_code, pat)) return false;
        }
      }
      return true;
    });
  }

  async function query(rawSql, params = []) {
    const sql = String(rawSql).replace(/\s+/g, ' ').trim();

    if (/^BEGIN$/i.test(sql)) {
      if (txDepth === 0) txSnapshot = structuredClone(state);
      txDepth += 1;
      return { rows: [], rowCount: 0 };
    }
    if (/^COMMIT$/i.test(sql)) {
      txDepth = Math.max(0, txDepth - 1);
      if (txDepth === 0) {
        txSnapshot = null;
        saveState();
      }
      return { rows: [], rowCount: 0 };
    }
    if (/^ROLLBACK$/i.test(sql)) {
      if (txSnapshot) state = txSnapshot;
      txDepth = 0;
      txSnapshot = null;
      return { rows: [], rowCount: 0 };
    }
    if (/^SELECT 1$/i.test(sql)) return { rows: [{ '?column?': 1 }], rowCount: 1 };
    if (/^SELECT pg_advisory_xact_lock/i.test(sql)) return { rows: [{ pg_advisory_xact_lock: '' }], rowCount: 1 };

    // --- VERIFY HASH CHAINS ---
    if (/FROM verify_audit_chain\(\)/i.test(sql)) {
      let prev = GENESIS_HASH;
      for (const row of state.audit_logs) {
        if (row.prev_hash !== prev) {
          return { rows: [{ checked: state.audit_logs.length, first_broken_audit_id: row.audit_id, reason: 'prev_hash mismatch' }] };
        }
        const expected = computeAuditHash(prev, row);
        if (row.row_hash !== expected) {
          return { rows: [{ checked: state.audit_logs.length, first_broken_audit_id: row.audit_id, reason: 'row_hash mismatch' }] };
        }
        prev = row.row_hash;
      }
      return { rows: [{ checked: state.audit_logs.length, first_broken_audit_id: null, reason: null }] };
    }
    if (/FROM verify_batch_events\(\$1\)/i.test(sql)) {
      const batchId = Number(params[0]);
      const evs = state.supply_chain_events.filter((e) => Number(e.batch_id) === batchId);
      let prev = GENESIS_HASH;
      for (const row of evs) {
        if (row.prev_hash !== prev) {
          return { rows: [{ checked: evs.length, first_broken_event_id: row.event_id, reason: 'prev_hash mismatch' }] };
        }
        const expected = computeEventHash(prev, row);
        if (row.row_hash !== expected) {
          return { rows: [{ checked: evs.length, first_broken_event_id: row.event_id, reason: 'row_hash mismatch' }] };
        }
        prev = row.row_hash;
      }
      return { rows: [{ checked: evs.length, first_broken_event_id: null, reason: null }] };
    }

    // --- PUBLIC TRACE VIEWS ---
    if (/FROM public_batch_trace WHERE batch_code = \$1/i.test(sql)) {
      const b = state.batches.find((row) => row.batch_code === params[0]);
      if (!b) return { rows: [] };
      const org = orgById(b.organization_id);
      return {
        rows: [{
          batch_code: b.batch_code,
          product_name: b.product_name,
          origin: b.origin,
          organization_name: org ? org.name : null,
          current_status: b.current_status,
        }],
      };
    }
    if (/FROM public_event_trace WHERE batch_code = \$1/i.test(sql)) {
      const b = state.batches.find((row) => row.batch_code === params[0]);
      if (!b) return { rows: [] };
      const evs = state.supply_chain_events
        .filter((e) => Number(e.batch_id) === Number(b.batch_id))
        .sort((a, c) => {
          const dt = Date.parse(a.timestamp) - Date.parse(c.timestamp);
          return dt !== 0 ? dt : EVENT_ORDER.indexOf(a.event_type) - EVENT_ORDER.indexOf(c.event_type);
        })
        .map((e) => {
          const full = enrichEvent(e);
          return {
            event_type: full.event_type,
            location: full.location,
            organization_name: full.organization_name,
            timestamp: full.timestamp,
          };
        });
      return { rows: evs };
    }

    // --- USERS ---
    if (/FROM users WHERE lower\(email\) = lower\(\$1\)/i.test(sql)) {
      const target = String(params[0] || '').toLowerCase();
      const row = state.users.find((u) => u.email.toLowerCase() === target);
      return { rows: row ? [{ ...row }] : [] };
    }
    if (/FROM users WHERE user_id = \$1/i.test(sql)) {
      const row = userById(params[0]);
      return { rows: row ? [{ ...row }] : [] };
    }
    if (/FROM users u LEFT JOIN organizations o .* WHERE u\.user_id = \$1/i.test(sql)) {
      const row = userById(params[0]);
      return { rows: row ? [enrichUser(row)] : [] };
    }
    if (/SELECT count\(\*\)::int AS n FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' AND user_id <> \$1/i.test(sql)) {
      const n = state.users.filter((u) => u.role === 'ADMIN' && u.status === 'ACTIVE' && Number(u.user_id) !== Number(params[0])).length;
      return { rows: [{ n }] };
    }
    if (/SELECT count\(\*\)::int AS total FROM users u/i.test(sql) || (/FROM users u LEFT JOIN organizations o/i.test(sql) && /ORDER BY u\.created_at DESC/i.test(sql))) {
      let filtered = [...state.users];
      const stM = sql.match(/u\.status\s*=\s*\$(\d+)/);
      if (stM) filtered = filtered.filter((u) => u.status === params[Number(stM[1]) - 1]);
      const rlM = sql.match(/u\.role\s*=\s*\$(\d+)/);
      if (rlM) filtered = filtered.filter((u) => u.role === params[Number(rlM[1]) - 1]);
      if (/SELECT count\(\*\)/i.test(sql)) return { rows: [{ total: filtered.length }] };
      filtered.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.user_id - a.user_id);
      const lim = Number(params[params.length - 2]) || 20;
      const off = Number(params[params.length - 1]) || 0;
      return { rows: filtered.slice(off, off + lim).map(enrichUser) };
    }
    if (/^INSERT INTO users\b/i.test(sql)) {
      const [name, email, passwordHash, role] = params;
      if (state.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
        throw makePgError('23505', 'duplicate email');
      }
      const row = {
        user_id: ++state.seq.users,
        organization_id: null,
        name,
        email,
        password_hash: passwordHash,
        role,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      };
      state.users.push(row);
      saveState();
      return { rows: [{ ...row }] };
    }
    if (/^UPDATE users SET name = \$2 WHERE user_id = \$1/i.test(sql)) {
      const row = userById(params[0]);
      if (!row) return { rows: [] };
      row.name = params[1];
      saveState();
      return { rows: [{ ...row }] };
    }
    if (/^UPDATE users SET role = \$2, organization_id = \$3 WHERE user_id = \$1/i.test(sql)) {
      const row = userById(params[0]);
      if (row) { row.role = params[1]; row.organization_id = params[2]; saveState(); }
      return { rows: [] };
    }
    if (/^UPDATE users SET organization_id = \$2 WHERE user_id = \$1/i.test(sql)) {
      const row = userById(params[0]);
      if (row) { row.organization_id = params[1]; saveState(); }
      return { rows: [] };
    }
    if (/^UPDATE users SET status = \$2 WHERE user_id = \$1/i.test(sql)) {
      const row = userById(params[0]);
      if (row) { row.status = params[1]; saveState(); }
      return { rows: [] };
    }

    // --- ORGANIZATIONS ---
    if (/FROM organizations WHERE organization_id = \$1/i.test(sql)) {
      const org = orgById(params[0]);
      return { rows: org ? [{ ...org }] : [] };
    }
    if (/SELECT \(SELECT count\(\*\) FROM users WHERE organization_id = \$1\)::int AS users/i.test(sql)) {
      const orgId = Number(params[0]);
      return {
        rows: [{
          users: state.users.filter((u) => Number(u.organization_id) === orgId).length,
          batches: state.batches.filter((b) => Number(b.organization_id) === orgId).length,
        }],
      };
    }
    if (/FROM organizations\b/i.test(sql) && (/SELECT count\(\*\)::int AS total/i.test(sql) || /ORDER BY name ASC/i.test(sql))) {
      let filtered = [...state.organizations];
      const tM = sql.match(/type\s*=\s*\$(\d+)/);
      if (tM) filtered = filtered.filter((o) => o.type === params[Number(tM[1]) - 1]);
      if (/SELECT count\(\*\)/i.test(sql)) return { rows: [{ total: filtered.length }] };
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.organization_id - b.organization_id);
      const lim = Number(params[params.length - 2]) || 20;
      const off = Number(params[params.length - 1]) || 0;
      return { rows: filtered.slice(off, off + lim).map((o) => ({ ...o })) };
    }
    if (/^INSERT INTO organizations\b/i.test(sql)) {
      const [name, type, address] = params;
      if (state.organizations.some((o) => o.name.toLowerCase() === String(name).toLowerCase() && o.type === type)) {
        throw makePgError('23505', 'duplicate organization');
      }
      const row = {
        organization_id: ++state.seq.organizations,
        name,
        type,
        address: address ?? null,
        created_at: new Date().toISOString(),
      };
      state.organizations.push(row);
      saveState();
      return { rows: [{ ...row }] };
    }
    if (/^UPDATE organizations SET /i.test(sql)) {
      const org = orgById(params[0]);
      if (!org) return { rows: [] };
      const setPart = sql.match(/^UPDATE organizations SET (.+) WHERE organization_id = \$1/i)[1];
      const next = { ...org };
      for (const assign of setPart.split(',')) {
        const m = assign.trim().match(/^(\w+)\s*=\s*\$(\d+)$/);
        if (m) next[m[1]] = params[Number(m[2]) - 1];
      }
      if (state.organizations.some((o) => o.organization_id !== org.organization_id && o.name.toLowerCase() === String(next.name).toLowerCase() && o.type === next.type)) {
        throw makePgError('23505', 'duplicate organization');
      }
      Object.assign(org, next);
      saveState();
      return { rows: [{ ...org }] };
    }

    // --- BATCHES ---
    if (/SELECT EXTRACT\(YEAR FROM now\(\)\)::int AS year/i.test(sql)) {
      const year = new Date().getFullYear();
      let maxSeq = 0;
      for (const b of state.batches) {
        const parts = String(b.batch_code || '').split('-');
        if (Number(parts[1]) === year) {
          const seq = Number(parts[2]) || 0;
          if (seq > maxSeq) maxSeq = seq;
        }
      }
      return { rows: [{ year, max_seq: maxSeq }] };
    }
    if (/^INSERT INTO batches\b/i.test(sql)) {
      const [batchCode, productName, origin, quantity, createdBy, organizationId] = params;
      if (state.batches.some((b) => b.batch_code === batchCode)) {
        throw makePgError('23505', 'duplicate batch_code');
      }
      const row = {
        batch_id: ++state.seq.batches,
        batch_code: batchCode,
        product_id: null,
        product_name: productName,
        origin,
        quantity: Number(quantity).toFixed(2),
        creation_date: new Date().toISOString(),
        current_status: 'CREATED',
        created_by: Number(createdBy),
        organization_id: Number(organizationId),
      };
      state.batches.push(row);
      saveState();
      return { rows: [{ ...row }] };
    }
    if (/^INSERT INTO qr_codes\b/i.test(sql)) {
      const [batchId, qrData, signatureHmac] = params;
      const row = {
        qr_id: ++state.seq.qr_codes,
        batch_id: Number(batchId),
        qr_data: qrData,
        signature_hmac: signatureHmac,
        created_at: new Date().toISOString(),
      };
      state.qr_codes.push(row);
      saveState();
      return { rows: [{ ...row }] };
    }
    if (/FROM qr_codes WHERE batch_id = \$1/i.test(sql)) {
      const row = state.qr_codes.find((q) => Number(q.batch_id) === Number(params[0]));
      return { rows: row ? [{ ...row }] : [] };
    }
    if (/FROM batches b WHERE b\.batch_id = \$1 AND /i.test(sql)) {
      const b = state.batches.find((row) => Number(row.batch_id) === Number(params[0]));
      if (!b || !matchesBatchScope(sql, params, b)) return { rows: [] };
      return { rows: [{ ...b }] };
    }
    if (/SELECT count\(\*\)::int AS total FROM batches b WHERE /i.test(sql)) {
      return { rows: [{ total: filterBatches(sql, params).length }] };
    }
    if (/FROM batches b WHERE /i.test(sql) && /ORDER BY b\.creation_date DESC/i.test(sql)) {
      const filtered = filterBatches(sql, params)
        .sort((a, b) => Date.parse(b.creation_date) - Date.parse(a.creation_date) || b.batch_id - a.batch_id);
      const lim = Number(params[params.length - 2]) || 20;
      const off = Number(params[params.length - 1]) || 0;
      return { rows: filtered.slice(off, off + lim).map((b) => ({ ...b })) };
    }
    if (/^UPDATE batches SET /i.test(sql)) {
      const b = state.batches.find((row) => Number(row.batch_id) === Number(params[0]));
      if (!b) return { rows: [] };
      const setPart = sql.match(/^UPDATE batches SET (.+) WHERE batch_id = \$1/i)[1];
      for (const assign of setPart.split(',')) {
        const m = assign.trim().match(/^(\w+)\s*=\s*\$(\d+)$/);
        if (m) {
          const val = params[Number(m[2]) - 1];
          b[m[1]] = m[1] === 'quantity' ? Number(val).toFixed(2) : val;
        }
      }
      saveState();
      return { rows: [{ ...b }] };
    }

    // --- SUPPLY CHAIN EVENTS ---
    if (/^INSERT INTO supply_chain_events\b/i.test(sql)) {
      const isCreatedInsert = /'CREATED'/.test(sql);
      const batchId = Number(params[0]);
      const actorId = Number(params[1]);
      const eventType = isCreatedInsert ? 'CREATED' : params[2];
      const location = isCreatedInsert ? params[2] : params[3];
      const description = isCreatedInsert ? null : (params[4] ?? null);

      const batchEvents = state.supply_chain_events.filter((e) => Number(e.batch_id) === batchId);
      const chainSeq = batchEvents.length + 1;
      const prevHash = batchEvents.length ? batchEvents[batchEvents.length - 1].row_hash : GENESIS_HASH;
      const row = {
        event_id: ++state.seq.supply_chain_events,
        batch_id: batchId,
        actor_id: actorId,
        event_type: eventType,
        timestamp: new Date().toISOString(),
        location,
        description,
        chain_seq: chainSeq,
        prev_hash: prevHash,
        row_hash: '',
      };
      row.row_hash = computeEventHash(prevHash, row);
      state.supply_chain_events.push(row);
      const batch = state.batches.find((b) => Number(b.batch_id) === batchId);
      if (batch) batch.current_status = eventType;
      saveState();
      return { rows: [{ event_id: row.event_id }] };
    }
    if (/FROM supply_chain_events e .* WHERE e\.event_id = \$1/i.test(sql)) {
      const row = state.supply_chain_events.find((e) => Number(e.event_id) === Number(params[0]));
      return { rows: row ? [enrichEvent(row)] : [] };
    }
    if (/FROM supply_chain_events e .* WHERE e\.batch_id = \$1/i.test(sql)) {
      const rows = state.supply_chain_events
        .filter((e) => Number(e.batch_id) === Number(params[0]))
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.event_id - b.event_id)
        .map(enrichEvent);
      return { rows };
    }

    // --- AUDIT LOGS ---
    if (/^INSERT INTO audit_logs\b/i.test(sql)) {
      const [actorId, action, entityType, entityId, oldValue, newValue] = params;
      const id = ++state.seq.audit_logs;
      const prevHash = state.audit_logs.length ? state.audit_logs[state.audit_logs.length - 1].row_hash : GENESIS_HASH;
      const row = {
        audit_id: id,
        actor_id: actorId ?? null,
        action,
        entity_type: entityType,
        entity_id: entityId ?? null,
        old_value: oldValue ?? null,
        new_value: newValue ?? null,
        created_at: new Date().toISOString(),
        chain_seq: id,
        prev_hash: prevHash,
        row_hash: '',
      };
      row.row_hash = computeAuditHash(prevHash, row);
      state.audit_logs.push(row);
      saveState();
      return { rows: [{ audit_id: id }] };
    }
    if (/FROM audit_logs a\b/i.test(sql)) {
      let filtered = [...state.audit_logs];
      const etM = sql.match(/a\.entity_type\s*=\s*\$(\d+)/);
      if (etM) filtered = filtered.filter((a) => a.entity_type === params[Number(etM[1]) - 1]);
      const eidM = sql.match(/a\.entity_id\s*=\s*\$(\d+)/);
      if (eidM) filtered = filtered.filter((a) => Number(a.entity_id) === Number(params[Number(eidM[1]) - 1]));
      const actIdM = sql.match(/a\.actor_id\s*=\s*\$(\d+)/);
      if (actIdM) filtered = filtered.filter((a) => Number(a.actor_id) === Number(params[Number(actIdM[1]) - 1]));
      const actionM = sql.match(/a\.action\s*=\s*\$(\d+)/);
      if (actionM) filtered = filtered.filter((a) => a.action === params[Number(actionM[1]) - 1]);
      const fromM = sql.match(/a\.created_at\s*>=\s*\$(\d+)/);
      if (fromM) filtered = filtered.filter((a) => Date.parse(a.created_at) >= Date.parse(params[Number(fromM[1]) - 1]));
      const toM = sql.match(/a\.created_at\s*<=\s*\$(\d+)/);
      if (toM) filtered = filtered.filter((a) => Date.parse(a.created_at) <= Date.parse(params[Number(toM[1]) - 1]));

      if (/SELECT count\(\*\)/i.test(sql)) return { rows: [{ total: filtered.length }] };
      filtered.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.audit_id - a.audit_id);
      const lim = Number(params[params.length - 2]) || 20;
      const off = Number(params[params.length - 1]) || 0;
      return {
        rows: filtered.slice(off, off + lim).map((a) => {
          const u = a.actor_id != null ? userById(a.actor_id) : null;
          return { ...a, actor_name: u ? u.name : null };
        }),
      };
    }

    throw new Error(`[demoDb] Unsupported query: ${sql}`);
  }

  return {
    query,
    async connect() {
      return {
        query,
        release() {},
      };
    },
    async end() {},
    reset() {
      return loadOrInit(true);
    },
    getFilePath() {
      return filePath;
    },
  };
}

module.exports = { createDemoDb, createInitialState, DEFAULT_DB_FILE };
