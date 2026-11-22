import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, errorMessage } from '../api.js'
import { formatDateOnly } from '../batches/batchConstants.js'
import {
  IconAlertTriangle,
  IconBuilding,
  IconEdit,
  IconMapPin,
  IconPlus,
  IconRefresh,
} from '../components/Icons.jsx'

const ORG_TYPE_META = {
  FARM: { label: 'Nông trại / HTX', tagClass: 'org-farm' },
  PROCESSOR: { label: 'Cơ sở chế biến', tagClass: 'org-processor' },
  DISTRIBUTOR: { label: 'Đơn vị phân phối', tagClass: 'org-distributor' },
}

export function OrganizationManagementView({ token }) {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [flash, setFlash] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'FARM', address: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [refreshTick, setRefreshTick] = useState(0)

  const loadOrgs = useCallback(() => {
    setLoading(true)
    setError('')
    setRefreshTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!token) return
    let active = true
    api
      .listOrganizations(token, { limit: 100 })
      .then((res) => {
        if (!active) return
        setOrgs(res.items || [])
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof ApiError ? errorMessage(err) : 'Không thể tải danh sách đơn vị.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [token, refreshTick])

  const filteredOrgs = useMemo(() => {
    if (!typeFilter) return orgs
    return orgs.filter((o) => o.type === typeFilter)
  }, [orgs, typeFilter])

  function openCreate() {
    setEditingOrg(null)
    setForm({ name: '', type: 'FARM', address: '' })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(org) {
    setEditingOrg(org)
    setForm({ name: org.name || '', type: org.type || 'FARM', address: org.address || '' })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) {
      setFormError('Vui lòng nhập tên đơn vị.')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      type: form.type,
      address: form.address.trim() || null,
    }
    try {
      if (editingOrg) {
        const updated = await api.updateOrganization(token, editingOrg.organizationId, payload)
        setOrgs((prev) => prev.map((o) => (o.organizationId === updated.organizationId ? updated : o)))
        setFlash(`Đã cập nhật thông tin đơn vị ${updated.name}.`)
      } else {
        const created = await api.createOrganization(token, payload)
        setOrgs((prev) => [created, ...prev])
        setFlash(`Đã tạo mới đơn vị ${created.name}.`)
      }
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof ApiError ? errorMessage(err) : 'Không thể lưu thông tin đơn vị.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-module-view">
      <div className="page-heading-row">
        <div>
          <h1>Quản lý đơn vị chuỗi cung ứng</h1>
          <p>Danh sách các nông trại, hợp tác xã, xưởng chế biến và doanh nghiệp phân phối được xác thực.</p>
        </div>
        <div className="heading-actions-group">
          <button type="button" className="button secondary with-icon" onClick={loadOrgs} disabled={loading}>
            <IconRefresh /> Làm mới
          </button>
          <button type="button" className="button primary with-icon" onClick={openCreate}>
            <IconPlus /> Thêm đơn vị
          </button>
        </div>
      </div>

      {flash && <div className="notice success" role="status">{flash}</div>}

      <div className="batches-card-container">
        <div className="table-controls-header">
          <div className="status-tabs-row" role="tablist">
            {[
              { key: '', label: `Tất cả (${orgs.length})` },
              { key: 'FARM', label: 'Nông trại / HTX' },
              { key: 'PROCESSOR', label: 'Cơ sở chế biến' },
              { key: 'DISTRIBUTOR', label: 'Đơn vị phân phối' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={typeFilter === t.key}
                className={`status-tab-chip ${typeFilter === t.key ? 'active' : ''}`}
                onClick={() => setTypeFilter(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="batches-loading-state" role="status">
            <div className="spinner-olive" />
            <p>Đang tải danh sách đơn vị…</p>
          </div>
        ) : error ? (
          <div className="state-block" role="alert">
            <IconAlertTriangle />
            <p>{error}</p>
            <button type="button" className="button secondary" onClick={loadOrgs}>Thử lại</button>
          </div>
        ) : (
          <div className="org-cards-grid">
            {filteredOrgs.map((org) => {
              const meta = ORG_TYPE_META[org.type] || { label: org.type, tagClass: '' }
              return (
                <article key={org.organizationId} className="org-item-card">
                  <div className="org-card-top">
                    <span className={`org-type-pill ${meta.tagClass}`}>{meta.label}</span>
                    <button
                      type="button"
                      className="action-icon-btn edit-btn"
                      onClick={() => openEdit(org)}
                    >
                      <IconEdit /> Sửa
                    </button>
                  </div>
                  <h3><IconBuilding /> {org.name}</h3>
                  <p className="org-address"><IconMapPin /> {org.address || 'Chưa cập nhật địa chỉ'}</p>
                  <div className="org-card-foot">
                    <span>Mã đơn vị: <code>#{org.organizationId}</code></span>
                    <span>Tham gia: {formatDateOnly(org.createdAt)}</span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)} role="dialog" aria-modal="true">
          <div className="qr-modal-card admin-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-kicker">{editingOrg ? 'CẬP NHẬT ĐƠN VỊ' : 'THÊM ĐƠN VỊ MỚI'}</span>
                <h3>{editingOrg ? editingOrg.name : 'Đăng ký đơn vị tham gia chuỗi'}</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <form className="admin-modal-form" onSubmit={handleSubmit}>
              {formError && <div className="notice error" role="alert">{formError}</div>}

              <div className="field">
                <label htmlFor="org-name">Tên đơn vị <span className="req-star">*</span></label>
                <input
                  id="org-name"
                  type="text"
                  placeholder="VD: HTX Rau sạch Đà Lạt"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={150}
                />
              </div>

              <div className="field">
                <label htmlFor="org-type">Loại hình hoạt động <span className="req-star">*</span></label>
                <select
                  id="org-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="FARM">Nông trại / Hợp tác xã</option>
                  <option value="PROCESSOR">Cơ sở sơ chế & Chế biến</option>
                  <option value="DISTRIBUTOR">Đơn vị vận chuyển & Phân phối</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="org-address">Địa chỉ trụ sở / vùng canh tác</label>
                <input
                  id="org-address"
                  type="text"
                  placeholder="VD: Xã Xuân Trường, TP. Đà Lạt, Lâm Đồng"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  maxLength={255}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                  Hủy
                </button>
                <button type="submit" className="button primary" disabled={saving}>
                  {saving ? 'Đang lưu…' : editingOrg ? 'Lưu thay đổi' : 'Tạo đơn vị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
