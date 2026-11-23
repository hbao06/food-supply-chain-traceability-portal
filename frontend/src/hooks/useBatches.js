import { useEffect, useState } from 'react'
import { api } from '../api.js'

// Tải toàn bộ lô trong phạm vi người dùng (tối đa 100) cho các trang báo cáo / bảng tiến độ / trung tâm QR.
export function useBatches(token, refreshKey = 0) {
  const requestKey = `${token || ''}|${refreshKey}`
  const [state, setState] = useState({ key: '', items: [], error: '' })

  useEffect(() => {
    if (!token) return
    let active = true
    api
      .listBatches(token, { limit: 100 })
      .then((data) => active && setState({ key: requestKey, items: data.items || [], error: '' }))
      .catch(() => active && setState({ key: requestKey, items: [], error: 'Không thể tải danh sách lô hàng.' }))
    return () => { active = false }
  }, [token, refreshKey, requestKey])

  return {
    items: state.key === requestKey ? state.items : [],
    loading: Boolean(token) && state.key !== requestKey,
    error: state.key === requestKey ? state.error : '',
  }
}
