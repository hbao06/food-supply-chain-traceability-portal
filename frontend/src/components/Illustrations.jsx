// Minh họa phẳng (flat) cho các chủ đề: xe tải lạnh, kho hàng, quét mã QR.
export function TruckIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 240 130" role="img" aria-label="Xe tải vận chuyển lạnh">
      <rect x="6" y="22" width="150" height="76" rx="8" fill="#FFFFFF" stroke="#CBD5B5" strokeWidth="2" />
      <rect x="16" y="34" width="130" height="10" rx="5" fill="#73932A" />
      <text x="26" y="72" fontFamily="Quicksand, sans-serif" fontWeight="700" fontSize="17" fill="#3D5A13">FR-2026</text>
      <text x="26" y="88" fontFamily="Quicksand, sans-serif" fontSize="10" fill="#646F63">Xe lạnh 2–8°C</text>
      <path d="M156 42h40l26 28v28h-66z" fill="#73932A" />
      <path d="M166 50h26l16 20h-42z" fill="#E8F1D4" />
      <rect x="6" y="98" width="216" height="8" rx="4" fill="#3D5A13" />
      <circle cx="52" cy="108" r="14" fill="#242B24" /><circle cx="52" cy="108" r="6" fill="#D5DCCB" />
      <circle cx="186" cy="108" r="14" fill="#242B24" /><circle cx="186" cy="108" r="6" fill="#D5DCCB" />
      <rect x="212" y="84" width="10" height="8" rx="3" fill="#E08253" />
    </svg>
  )
}

export function WarehouseIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 240 130" role="img" aria-label="Kho hàng">
      <path d="M12 52 120 12l108 40v70H12z" fill="#FFFFFF" stroke="#CBD5B5" strokeWidth="2" />
      <path d="M12 52 120 12l108 40" fill="none" stroke="#73932A" strokeWidth="6" strokeLinejoin="round" />
      <rect x="62" y="70" width="116" height="52" rx="4" fill="#E8F1D4" stroke="#73932A" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1="62" x2="178" y1={78 + i * 8} y2={78 + i * 8} stroke="#B9CC8A" strokeWidth="2" />
      ))}
      <rect x="22" y="96" width="26" height="26" rx="3" fill="#E08253" />
      <rect x="192" y="96" width="26" height="26" rx="3" fill="#E08253" />
      <rect x="28" y="102" width="14" height="14" fill="#FFFFFF" />
      <rect x="198" y="102" width="14" height="14" fill="#FFFFFF" />
    </svg>
  )
}

const QR_CELLS = [[0,0],[1,0],[2,0],[4,0],[6,0],[0,1],[2,1],[3,1],[6,1],[0,2],[1,2],[2,2],[4,2],[5,2],[3,3],[5,3],[0,4],[1,4],[2,4],[4,4],[6,4],[0,5],[2,5],[3,5],[5,5],[0,6],[1,6],[2,6],[4,6],[6,6]]

export function QrPhoneIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 160 200" role="img" aria-label="Quét mã QR bằng điện thoại">
      <rect x="20" y="4" width="120" height="192" rx="20" fill="#242B24" />
      <rect x="28" y="16" width="104" height="168" rx="12" fill="#FFFFFF" />
      <g transform="translate(46 44)">
        {QR_CELLS.map(([x, y]) => <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="9" height="9" rx="1.5" fill="#2D4316" />)}
      </g>
      <path d="M40 40v-14h14M120 40v-14h-14M40 126v14h14M120 126v14h-14" fill="none" stroke="#E08253" strokeWidth="4" strokeLinecap="round" />
      <rect x="44" y="154" width="72" height="10" rx="5" fill="#E8F1D4" />
      <rect x="44" y="170" width="48" height="6" rx="3" fill="#EEF0E8" />
    </svg>
  )
}
