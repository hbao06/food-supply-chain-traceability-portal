'use strict';

const { NotFoundError, ConflictError } = require('../../common/errors');

// Loại đơn vị tương ứng với từng vai trò (giống org_type_for_role trong schema.sql).
const ORG_TYPE_FOR_ROLE = { FARMER: 'FARM', PROCESSOR: 'PROCESSOR', DISTRIBUTOR: 'DISTRIBUTOR' };

const NO_USER = () => new NotFoundError('NOT_FOUND', 'Không tìm thấy tài khoản');
const NO_ORG = () => new NotFoundError('NOT_FOUND', 'Không tìm thấy đơn vị');
const num = (v) => (v == null ? null : Number(v));

function toAdminUserDto(row) {
  return {
    userId: Number(row.user_id), name: row.name, email: row.email, role: row.role, status: row.status,
    organizationId: num(row.organization_id), organizationName: row.organization_name ?? null, createdAt: row.created_at,
  };
}
function toOrganizationDto(row) {
  return { organizationId: Number(row.organization_id), name: row.name, type: row.type, address: row.address ?? null, createdAt: row.created_at };
}
function toAuditDto(row) {
  return {
    auditId: Number(row.audit_id), actorId: num(row.actor_id), actorName: row.actor_name ?? null, action: row.action,
    entityType: row.entity_type, entityId: num(row.entity_id), oldValue: row.old_value ?? null, newValue: row.new_value ?? null, createdAt: row.created_at,
  };
}
const page = (items, p, limit, total) => ({ items, page: p, limit, total });

// Phụ thuộc được truyền vào (db, repo, insertAudit...) để test không cần CSDL thật.
// Mọi thay đổi chạy trong MỘT transaction cùng dòng audit; trigger của CSDL vẫn là lớp chặn cuối.
function createAdminService({ db, withTransaction, repo, insertAudit }) {
  async function listUsers({ status, role, page: p, limit }) {
    const { rows, total } = await repo.listUsers(db, { status, role, limit, offset: (p - 1) * limit });
    return page(rows.map(toAdminUserDto), p, limit, total);
  }

  // Đổi vai trò (chỉ FARMER / PROCESSOR / DISTRIBUTOR). Có thể kèm organizationId để đổi đơn vị cùng lúc,
  // vì vai trò mới cần đơn vị loại khác và không thể đổi từng thứ một mà không vi phạm quy tắc.
  async function changeRole(auth, userId, { role, organizationId }) {
    return withTransaction(async (tx) => {
      const u = await repo.findUserForUpdate(tx, userId);
      if (!u) throw NO_USER();
      if (u.role === 'ADMIN') throw new ConflictError('ROLE_CHANGE_NOT_ALLOWED', 'Không đổi vai trò của tài khoản Admin qua API');

      let newOrgId = num(u.organization_id);
      let orgType = u.organization_type;
      if (organizationId !== undefined) {
        const org = await repo.findOrganization(tx, organizationId);
        if (!org) throw NO_ORG();
        newOrgId = Number(org.organization_id);
        orgType = org.type;
      }
      if (newOrgId != null && orgType !== ORG_TYPE_FOR_ROLE[role]) {
        throw new ConflictError('ORG_TYPE_MISMATCH',
          `Vai trò ${role} cần đơn vị loại ${ORG_TYPE_FOR_ROLE[role]}, đơn vị hiện tại thuộc loại ${orgType}. Gửi kèm organizationId của đơn vị phù hợp`);
      }
      if (role === u.role && newOrgId === num(u.organization_id)) return toAdminUserDto(u); // không đổi gì thì không ghi audit

      await repo.updateUserRoleAndOrganization(tx, userId, role, newOrgId);
      await insertAudit(tx, { actorId: auth.userId, action: 'CHANGE_ROLE', entityType: 'USER', entityId: userId,
        oldValue: { role: u.role, organizationId: num(u.organization_id) }, newValue: { role, organizationId: newOrgId } });
      return toAdminUserDto(await repo.findUserDetail(tx, userId));
    });
  }

  async function assignOrganization(auth, userId, { organizationId }) {
    return withTransaction(async (tx) => {
      const u = await repo.findUserForUpdate(tx, userId);
      if (!u) throw NO_USER();
      if (u.role === 'ADMIN') throw new ConflictError('ADMIN_HAS_NO_ORGANIZATION', 'Tài khoản Admin không thuộc đơn vị nào');
      const org = await repo.findOrganization(tx, organizationId);
      if (!org) throw NO_ORG();
      if (org.type !== ORG_TYPE_FOR_ROLE[u.role]) {
        throw new ConflictError('ORG_TYPE_MISMATCH', `Vai trò ${u.role} cần đơn vị loại ${ORG_TYPE_FOR_ROLE[u.role]}, đơn vị này thuộc loại ${org.type}`);
      }
      if (num(u.organization_id) === Number(org.organization_id)) return toAdminUserDto(u);

      await repo.updateUserOrganization(tx, userId, organizationId);
      await insertAudit(tx, { actorId: auth.userId, action: 'ASSIGN_ORGANIZATION', entityType: 'USER', entityId: userId,
        oldValue: { organizationId: num(u.organization_id) }, newValue: { organizationId } });
      return toAdminUserDto(await repo.findUserDetail(tx, userId));
    });
  }

  // Duyệt (PENDING -> ACTIVE), mở khóa (LOCKED -> ACTIVE), khóa (-> LOCKED).
  async function changeStatus(auth, userId, { status }) {
    return withTransaction(async (tx) => {
      const u = await repo.findUserForUpdate(tx, userId);
      if (!u) throw NO_USER();
      if (Number(u.user_id) === auth.userId) {
        throw new ConflictError('CANNOT_MODIFY_SELF', 'Không thể thay đổi trạng thái tài khoản của chính mình');
      }
      if (u.status === status) return toAdminUserDto(u);
      if (status === 'ACTIVE' && u.role !== 'ADMIN' && u.organization_id == null) {
        throw new ConflictError('ORGANIZATION_REQUIRED', 'Cần gán đơn vị trước khi duyệt hoặc mở khóa tài khoản');
      }
      if (status === 'LOCKED' && u.role === 'ADMIN' && u.status === 'ACTIVE' && (await repo.countOtherActiveAdmins(tx, userId)) === 0) {
        throw new ConflictError('LAST_ADMIN', 'Không thể khóa Admin đang hoạt động cuối cùng');
      }
      const action = status === 'LOCKED' ? 'LOCK' : (u.status === 'PENDING' ? 'APPROVE' : 'UNLOCK');
      await repo.updateUserStatus(tx, userId, status);
      await insertAudit(tx, { actorId: auth.userId, action, entityType: 'USER', entityId: userId,
        oldValue: { status: u.status }, newValue: { status } });
      return toAdminUserDto(await repo.findUserDetail(tx, userId));
    });
  }

  async function listOrganizations({ type, page: p, limit }) {
    const { rows, total } = await repo.listOrganizations(db, { type, limit, offset: (p - 1) * limit });
    return page(rows.map(toOrganizationDto), p, limit, total);
  }

  const duplicate = (err) => (err && err.code === '23505'
    ? new ConflictError('ORGANIZATION_EXISTS', 'Đơn vị cùng tên và cùng loại đã tồn tại') : err);

  async function createOrganization(auth, input) {
    return withTransaction(async (tx) => {
      let row;
      try { row = await repo.insertOrganization(tx, input); } catch (err) { throw duplicate(err); }
      await insertAudit(tx, { actorId: auth.userId, action: 'CREATE', entityType: 'ORGANIZATION', entityId: Number(row.organization_id), newValue: input });
      return toOrganizationDto(row);
    });
  }

  // Không có endpoint xóa đơn vị. Không đổi loại khi đã có thành viên hoặc lô (R5).
  async function updateOrganization(auth, organizationId, changes) {
    return withTransaction(async (tx) => {
      const org = await repo.findOrganization(tx, organizationId, { forUpdate: true });
      if (!org) throw NO_ORG();
      const current = { name: org.name, type: org.type, address: org.address ?? null };
      const diff = {};
      for (const [field, value] of Object.entries(changes)) if (current[field] !== value) diff[field] = value;
      if (Object.keys(diff).length === 0) return toOrganizationDto(org);
      if (diff.type !== undefined) {
        const usage = await repo.countOrganizationUsage(tx, organizationId);
        if (usage.users > 0 || usage.batches > 0) {
          throw new ConflictError('ORGANIZATION_IN_USE', 'Đơn vị đã có thành viên hoặc lô, không thể đổi loại');
        }
      }
      let updated;
      try { updated = await repo.updateOrganization(tx, organizationId, diff); } catch (err) { throw duplicate(err); }
      const oldValue = {}; for (const f of Object.keys(diff)) oldValue[f] = current[f];
      await insertAudit(tx, { actorId: auth.userId, action: 'UPDATE', entityType: 'ORGANIZATION', entityId: organizationId, oldValue, newValue: diff });
      return toOrganizationDto(updated);
    });
  }

  async function listAuditLogs({ page: p, limit, ...filters }) {
    const { rows, total } = await repo.listAuditLogs(db, { ...filters, limit, offset: (p - 1) * limit });
    return page(rows.map(toAuditDto), p, limit, total);
  }

  return { listUsers, changeRole, assignOrganization, changeStatus, listOrganizations, createOrganization, updateOrganization, listAuditLogs };
}

module.exports = { createAdminService, toAdminUserDto, toOrganizationDto, toAuditDto, ORG_TYPE_FOR_ROLE };
