import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { PREVIEW_BATCHES } from '../batches/batchConstants.js'

// Tải toàn bộ lô trong phạm vi người dùng (tối đa 100) cho các trang báo cáo / bảng tiến độ / trung tâm QR.
export function useBatches(token, preview, refreshKey = 0) {
  const [state, setState] = useState({ items: [], loading: true, error: '' })
  useEffect(() => {
    if (preview || !token) return
    let active = true
    api
      .listBatches(token, { limit: 100 })
      .then((data) => active && setState({ items: data.items || [], loading: false, error: '' }))
      .catch(() => active && setState({ items: [], loading: false, error: 'Không thể tải danh sách lô hàng.' }))
    return () => { active = false }
  }, [token, preview, refreshKey])
  if (preview) return { items: PREVIEW_BATCHES, loading: false, error: '' }
  return state
}
