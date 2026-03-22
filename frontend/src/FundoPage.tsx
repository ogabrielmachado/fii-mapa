import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const API = 'https://fii-mapa-worker.gabrielmachado.workers.dev'

const TIPO_CORES: Record<string, string> = {
  'Imóveis para renda acabados':       '#2563eb',
  'Imóveis para venda acabados':       '#16a34a',
  'Imóveis para renda em construção':  '#d97706',
  'Imóveis para venda em construção':  '#dc2626',
  'Terrenos':                          '#7c3aed',
}

function criarIcone(tipo: string) {
  const cor = TIPO_CORES[tipo] || '#64748b'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="30" viewBox="0 0 24 36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${cor}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [20, 30], iconAnchor: [10, 30], popupAnchor: [0, -30] })
}

type Imovel = {
  id: number
  descricao: string
  endereco: string
  tipo: string
  area_m2: number
  lat: number
  lon: number
  cidade: string
  estado: string
}

type Historico = {
  data_referencia: string
  total_imoveis: number
  area_total: number
}

type FundoDetalhe = {
  cnpj: string
  nome: string
  total_imoveis: number
  area_total: number
  total_estados: number
  total_tipos: number
}

export default function FundoPage({ cnpj, onVoltar }: { cnpj: string; onVoltar: () => void }) {
  const [fundo, setFundo]     = useState<FundoDetalhe | null>(null)
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [historico, setHistorico] = useState<Historico[]>([])
  const [busca, setBusca]     = useState('')

  useEffect(() => {
    fetch(`${API}/fundos/${encodeURIComponent(cnpj)}`).then(r => r.json()).then(setFundo)
    fetch(`${API}/fundos/${encodeURIComponent(cnpj)}/imoveis`).then(r => r.json()).then(setImoveis)
    fetch(`${API}/fundos/${encodeURIComponent(cnpj)}/historico`).then(r => r.json()).then(setHistorico)
  }, [cnpj])

  const imoveisFiltrados = imoveis.filter(im =>
    !busca || im.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
    im.endereco?.toLowerCase().includes(busca.toLowerCase())
  )

  const imoveisComCoords = imoveis.filter(im => im.lat && im.lon)
  const centro = imoveisComCoords.length > 0
    ? [imoveisComCoords.reduce((s, im) => s + im.lat, 0) / imoveisComCoords.length,
       imoveisComCoords.reduce((s, im) => s + im.lon, 0) / imoveisComCoords.length] as [number, number]
    : [-15.7801, -47.9292] as [number, number]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', background: '#f8fafc' }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={onVoltar}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#2563eb', padding: 0 }}>
          ← Voltar ao mapa
        </button>
        <span style={{ color: '#e2e8f0' }}>|</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{fundo?.nome || '...'}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{cnpj}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Stats */}
        {fundo && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
            {[
              { val: fundo.total_imoveis, lbl: 'Imóveis' },
              { val: fundo.area_total ? `${(fundo.area_total / 1000).toFixed(0)}k` : '—', lbl: 'm² total' },
              { val: fundo.total_estados, lbl: 'Estados' },
              { val: fundo.total_tipos, lbl: 'Tipos' },
            ].map(s => (
              <div key={s.lbl} style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px 16px' }}>
                <div style={{ fontSize: '22px', fontWeight: 600, color: '#0f172a' }}>{s.val}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* Mini mapa */}
        {imoveisComCoords.length > 0 && (
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', height: '220px' }}>
            <MapContainer center={centro} zoom={6} style={{ height: '100%', width: '100%' }} zoomControl={true} scrollWheelZoom={false}>
              <TileLayer attribution='&copy; OpenStreetMap' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'/>
              {imoveisComCoords.map(im => (
                <Marker key={im.id} position={[im.lat, im.lon]} icon={criarIcone(im.tipo)}>
                  <Popup>
                    <strong>{im.descricao}</strong><br/>
                    {im.endereco}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}

        {/* Gráfico histórico */}
        {historico.length > 1 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
              Evolução do portfólio
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={historico} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradImoveis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis
                  dataKey="data_referencia"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => v.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false}/>
                <Tooltip
                  contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  labelFormatter={(v) => `Trimestre: ${v}`}
                  formatter={(v: any) => [`${v} imóveis`, 'Portfólio']}
                />
                <Area
                  type="monotone"
                  dataKey="total_imoveis"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#gradImoveis)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Lista de imóveis */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', flex: 1 }}>
              Imóveis ({imoveisFiltrados.length})
            </div>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar imóvel..."
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', width: '180px' }}
            />
          </div>

          {imoveisFiltrados.map((im, i) => (
            <div key={im.id} style={{ padding: '12px 16px', borderBottom: i < imoveisFiltrados.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: TIPO_CORES[im.tipo] || '#64748b', flexShrink: 0, marginTop: '5px' }}/>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a' }}>{im.descricao || '—'}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{im.endereco || '—'}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {im.area_m2 && <div style={{ fontSize: '12px', color: '#0f172a' }}>{Number(im.area_m2).toLocaleString('pt-BR')} m²</div>}
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{im.tipo?.replace('Imóveis para ', '') || '—'}</div>
              </div>
            </div>
          ))}

          {imoveisFiltrados.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Nenhum imóvel encontrado
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
