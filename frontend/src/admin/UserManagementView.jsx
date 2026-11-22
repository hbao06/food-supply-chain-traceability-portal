import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import { formatDateOnly } from '../batches/batchConstants.js'
import {
  IconAlertTriangle,
  IconBuilding,
  IconCheck,
  IconLock,
  IconRefresh,
  IconUnlock,
  IconUser,
} from '../components/Icons.jsx'

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  FARMER: 'Nông trại',
  PROCESSOR: 'Cơ sở chế biến',
  DISTRIBUTOR: 'Đơn vị phân phối',
}

const ORG_TYPE_FOR_ROLE = {
  FARMER: 'FARM',
  PROCESSOR: 'PROCESSOR',
  DISTRIBUTOR: 'DISTRIBUTOR',
}

const ORG_TYPE_LABELS_VI = {
  FARM: 'Nông trại / HTX',
  PROCESSOR: 'Cơ sở chế biến',
  DISTRIBUTOR: 'Đơn vị phân phối',
}

const STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động',
  PENDING: 'Chờ duyệt',
  LOCKED: 'Đã khóa',
}

export function UserManagementView({ token, currentUser }) {
  const [users, setUsers] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [flash, setFlash] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  // Modal state for assigning organization / approving / changing role
  const [modalUser, setModalUser] = useState(null)
  const [modalRole, setModalRole] = useState('')
  const [modalOrgId, setModalOrgId] = useState('')
  const [modalApproveToo, setModalApproveToo] = useState(false)
  const [modalBusy, setModalBusy] = useState(false)
  const [modalError, setModalError] = useState('')

  const [refreshTick, setRefreshTick] = useState(0)

  const loadData = useCallback(() => {
    setLoading(true)
    setError('')
    setRefreshTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!token) return
    let active = true
    Promise.all([
      api.listUsers(token, { limit: 100 }),
      api.listOrganizations(token, { limit: 100 }),
    ])
      .then(([uRes, oRes]) => {
        if (!active) return
        setUsers(uRes.items || [])
        setOrgs(oRes.items || [])
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof ApiError ? errorMessage(err) : 'Không thể tải danh sách tài khoản.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [token, refreshTick])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter && u.status !== statusFilter) return false
      if (roleFilter && u.role !== roleFilter) return false
      return true
    })
  }, [users, statusFilter, roleFilter])

  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === 'ACTIVE').length,
    pending: users.filter((u) => u.status === 'PENDING').length,
    locked: users.filter((u) => u.status === 'LOCKED').length,
  }), [users])

  function openConfigModal(user, approveFlow = false) {
    setModalUser(user)
    setModalRole(user.role)
    setModalOrgId(user.organizationId ? String(user.organizationId) : '')
    setModalApproveToo(approveFlow)
    setModalError('')
  }

  const matchingOrgs = useMemo(() => {
    const neededType = ORG_TYPE_FOR_ROLE[modalRole]
    if (!neededType) return []
    return orgs.filter((o) => o.type === neededType)
  }, [orgs, modalRole])

  async function handleSaveModal(e) {
    e.preventDefault()
    if (!modalUser) return
    setModalError('')
    setActionError('')

    const chosenOrgId = modalOrgId ? Number(modalOrgId) : null
    if (modalApproveToo && modalRole !== 'ADMIN' && !chosenOrgId) {
      setModalError('Vui lòng chọn đơn vị phù hợp trước khi duyệt kích hoạt tài khoản.')
      return
    }

    setModalBusy(true)
    try {
      let updated = modalUser
      if (modalRole !== modalUser.role) {
        const body = { role: modalRole }
        if (chosenOrgId) body.organizationId = chosenOrgId
        updated = await api.changeUserRole(token, modalUser.userId, body)
      } else if (chosenOrgId && chosenOrgId !== modalUser.organizationId) {
        updated = await api.assignUserOrganization(token, modalUser.userId, { organizationId: chosenOrgId })
      }

      if (modalApproveToo && updated.status !== 'ACTIVE') {
        updated = await api.changeUserStatus(token, modalUser.userId, { status: 'ACTIVE' })
      }

      setUsers((prev) => prev.map((u) => (u.userId === updated.userId ? updated : u)))
      setFlash(
        modalApproveToo
          ? `Đã gán đơn vị và duyệt kích hoạt tài khoản ${updated.name}.`
          : `Đã cập nhật vai trò / đơn vị cho tài khoản ${updated.name}.`
      )
      setModalUser(null)
    } catch (err) {
      setModalError(err instanceof ApiError ? errorMessage(err) : 'Không thể cập nhật tài khoản.')
    } finally {
      setModalBusy(false)
    }
  }

  async function handleToggleStatus(user, targetStatus) {
    setActionError('')
    setFlash('')
    if (targetStatus === 'ACTIVE' && user.role !== 'ADMIN' && !user.organizationId) {
      openConfigModal(user, true)
      return
    }
    setBusyId(user.userId)
    try {
      const updated = await api.changeUserStatus(token, user.userId, { status: targetStatus })
      setUsers((prev) => prev.map((u) => (u.userId === updated.userId ? updated : u)))
      setFlash(`Đã cập nhật trạng thái tài khoản ${updated.name} thành ${STATUS_LABELS[updated.status]}.`)
    } catch (err) {
      setActionError(err instanceof ApiError ? errorMessage(err) : 'Không thể cập nhật trạng thái tài khoản.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-module-view">
      <div className="page-heading-row">
        <div>
          <h1>Quản lý tài khoản & Phân quyền</h1>
          <p>Duyệt tài khoản đối tác đăng ký mới, gán đơn vị hoạt động và kiểm soát trạng thái truy cập.</p>
        </div>
        <button type="button" className="button secondary with-icon" onClick={loadData} disabled={loading}>
          <IconRefresh /> Làm mới
        </button>
      </div>

      {flash && <div className="notice success" role="status">{flash}</div>}
      {actionError && <div className="notice error" role="alert">{actionError}</div>}

      <div className="batch-stats-strip">
        <div className="metric-pill-card">
          <span className="metric-label">Tổng tài khoản</span>
          <div className="metric-value-wrap">
            <span className="metric-number">{counts.total}</span>
            <span className="metric-tag total">Hệ thống</span>
          </div>
        </div>
        <div className="metric-pill-card">
          <span className="metric-label">Đang hoạt động</span>
          <div className="metric-value-wrap">
            <span className="metric-number emerald">{counts.active}</span>
            <span className="metric-tag emerald">Hoạt động</span>
          </div>
        </div>
        <div className="metric-pill-card">
          <span className="metric-label">Chờ phê duyệt</span>
          <div className="metric-value-wrap">
            <span className="metric-number orange">{counts.pending}</span>
            <span className="metric-tag orange">Chờ duyệt</span>
          </div>
        </div>
        <div className="metric-pill-card">
          <span className="metric-label">Đang bị khóa</span>
          <div className="metric-value-wrap">
            <span className="metric-number muted-num">{counts.locked}</span>
            <span className="metric-tag muted-tag">Đã khóa</span>
          </div>
        </div>
      </div>

      <div className="batches-card-container">
        <div className="table-controls-header admin-controls-row">
          <div className="status-tabs-row" role="tablist">
            {[
              { key: '', label: 'Tất cả' },
              { key: 'PENDING', label: `Chờ duyệt (${counts.pending})` },
              { key: 'ACTIVE', label: 'Đang hoạt động' },
              { key: 'LOCKED', label: 'Đã khóa' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={statusFilter === t.key}
                className={`status-tab-chip ${statusFilter === t.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <select
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Lọc theo vai trò"
          >
            <option value="">Mọi vai trò</option>
            <option value="FARMER">Nông trại</option>
            <option value="PROCESSOR">Cơ sở chế biến</option>
            <option value="DISTRIBUTOR">Đơn vị phân phối</option>
            <option value="ADMIN">Quản trị viên</option>
          </select>
        </div>

        {loading ? (
          <div className="batches-loading-state" role="status">
            <div className="spinner-olive" />
            <p>Đang tải danh sách tài khoản…</p>
          </div>
        ) : error ? (
          <div className="state-block" role="alert">
            <IconAlertTriangle />
            <p>{error}</p>
            <button type="button" className="button secondary" onClick={loadData}>Thử lại</button>
          </div>
        ) : (
          <div className="table-responsive-desktop">
            <table className="batches-table">
              <thead>
                <tr>
                  <th scope="col">Thành viên</th>
                  <th scope="col">Vai trò</th>
                  <th scope="col">Đơn vị trực thuộc</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Ngày tạo</th>
                  <th scope="col" className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = currentUser && Number(currentUser.userId) === Number(u.userId)
                  const isAdminRow = u.role === 'ADMIN'
                  const busy = busyId === u.userId

                  return (
                    <tr key={u.userId}>
                      <td>
                        <div className="admin-user-cell">
                          <span className="admin-mini-avatar">{(u.name || 'U')[0]}</span>
                          <div>
                            <strong>{u.name} {isSelf && <span className="self-tag">(Bạn)</span>}</strong>
                            <small>{u.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-pill role-${u.role.toLowerCase()}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        {u.organizationName ? (
                          <span className="org-inline"><IconBuilding /> {u.organizationName}</span>
                        ) : (
                          <span className="muted-inline">{isAdminRow ? 'Toàn hệ thống' : 'Chưa gán đơn vị'}</span>
                        )}
                      </td>
                      <td>
                        <span className={`user-status-pill st-${u.status.toLowerCase()}`}>
                          <span className="dot" /> {STATUS_LABELS[u.status] || u.status}
                        </span>
                      </td>
                      <td><span className="date-text">{formatDateOnly(u.createdAt)}</span></td>
                      <td className="text-right">
                        <div className="row-action-buttons">
                          {!isAdminRow && (
                            <button
                              type="button"
                              className="action-icon-btn edit-btn"
                              disabled={busy}
                              onClick={() => openConfigModal(u, u.status === 'PENDING')}
                            >
                              <IconUser /> {u.status === 'PENDING' ? 'Gán & Duyệt' : 'Đơn vị / Vai trò'}
                            </button>
                          )}
                          {!isSelf && u.status === 'PENDING' && u.organizationId && (
                            <button
                              type="button"
                              className="action-icon-btn qr-btn"
                              disabled={busy}
                              onClick={() => handleToggleStatus(u, 'ACTIVE')}
                            >
                              <IconCheck /> Duyệt
                            </button>
                          )}
                          {!isSelf && u.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="action-icon-btn danger-btn"
                              disabled={busy}
                              onClick={() => handleToggleStatus(u, 'LOCKED')}
                            >
                              <IconLock /> Khóa
                            </button>
                          )}
                          {!isSelf && u.status === 'LOCKED' && (
                            <button
                              type="button"
                              className="action-icon-btn qr-btn"
                              disabled={busy}
                              onClick={() => handleToggleStatus(u, 'ACTIVE')}
                            >
                              <IconUnlock /> Mở khóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Assign Organization / Role / Approve */}
      {modalUser && (
        <div className="modal-overlay" onClick={() => setModalUser(null)} role="dialog" aria-modal="true">
          <div className="qr-modal-card admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-kicker">CẤU HÌNH TÀI KHOẢN</span>
                <h3>{modalApproveToo ? `Duyệt & gán đơn vị: ${modalUser.name}` : `Cập nhật: ${modalUser.name}`}</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setModalUser(null)}>✕</button>
            </div>

            <form className="admin-modal-form" onSubmit={handleSaveModal}>
              {modalError && <div className="notice error" role="alert">{modalError}</div>}

              <div className="field">
                <label htmlFor="modal-user-role">Vai trò tham gia chuỗi cung ứng</label>
                <select
                  id="modal-user-role"
                  value={modalRole}
                  onChange={(e) => {
                    setModalRole(e.target.value)
                    setModalOrgId('')
                  }}
                >
                  <option value="FARMER">Nông trại</option>
                  <option value="PROCESSOR">Cơ sở chế biến</option>
                  <option value="DISTRIBUTOR">Đơn vị phân phối</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="modal-user-org">
                  Đơn vị trực thuộc ({ORG_TYPE_LABELS_VI[ORG_TYPE_FOR_ROLE[modalRole]] || ORG_TYPE_FOR_ROLE[modalRole]})
                </label>
                <select
                  id="modal-user-org"
                  value={modalOrgId}
                  onChange={(e) => setModalOrgId(e.target.value)}
                >
                  <option value="">-- Chọn đơn vị phù hợp --</option>
                  {matchingOrgs.map((o) => (
                    <option key={o.organizationId} value={o.organizationId}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {modalUser.status === 'PENDING' && (
                <label className="checkbox-inline-row">
                  <input
                    type="checkbox"
                    checked={modalApproveToo}
                    onChange={(e) => setModalApproveToo(e.target.checked)}
                  />
                  <span>Kích hoạt tài khoản sang trạng thái <strong>Đang hoạt động</strong> ngay sau khi lưu</span>
                </label>
              )}

              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setModalUser(null)} disabled={modalBusy}>
                  Hủy
                </button>
                <button type="submit" className="button primary" disabled={modalBusy}>
                  {modalBusy ? 'Đang lưu…' : modalApproveToo ? 'Lưu & Duyệt tài khoản' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
