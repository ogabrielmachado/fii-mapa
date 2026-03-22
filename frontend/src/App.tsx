import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'
import 'leaflet.markercluster'
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch'
import 'leaflet-geosearch/dist/geosearch.css'

const API = 'https://fii-mapa-worker.gabrielmachado.workers.dev'

const TIPO_CORES: Record<string, string> = {
  'Imóveis para renda acabados':       '#2563eb',
  'Imóveis para venda acabados':       '#16a34a',
  'Imóveis para renda em construção':  '#d97706',
  'Imóveis para venda em construção':  '#dc2626',
  'Terrenos':                          '#7c3aed',
}
const COR_DEFAULT = '#64748b'

function corPorTipo(tipo: string) {
  return TIPO_CORES[tipo] || COR_DEFAULT
}

function criarIcone(tipo: string) {
  const cor = corPorTipo(tipo)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${cor}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36] })
}

type Imovel = {
  id: number
  descricao: string
  endereco: string
  tipo: string
  area_m2: number
  lat: number
  lon: number
  fundo_nome: string
  cnpj: string
}

type Fundo = { cnpj: string; nome: string }
type Stats = { total_imoveis: number; total_fundos: number; com_coords: number }

function ClusterLayer({ imoveis, onSelect }: { imoveis: Imovel[], onSelect: (im: Imovel) => void }) {
  const map = useMap()
  const layerRef = useRef<any>(null)
  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current)
    const cluster = (L as any).markerClusterGroup({ maxClusterRadius: 50, spiderfyOnMaxZoom: true, showCoverageOnHover: false })
    imoveis.forEach(im => {
      const marker = L.marker([im.lat, im.lon], { icon: criarIcone(im.tipo) })
      marker.on('click', () => onSelect(im))
      cluster.addLayer(marker)
    })
    map.addLayer(cluster)
    layerRef.current = cluster
    return () => { map.removeLayer(cluster) }
  }, [imoveis])
  return null
}

function SearchControl() {
  const map = useMap()
  useEffect(() => {
    const provider = new OpenStreetMapProvider({ params: { countrycodes: 'br', addressdetails: 1 } })
    const search = GeoSearchControl({
      provider,
      style: 'bar',
      placeholder: 'Buscar endereço...',
      showMarker: true,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: false,
      searchLabel: 'Buscar',
    })
    map.addControl(search)
    return () => { map.removeControl(search) }
  }, [])
  return null
}

export default function App() {
  const [imoveis, setImoveis]         = useState<Imovel[]>([])
  const [fundos, setFundos]           = useState<Fundo[]>([])
  const [tipos, setTipos]             = useState<string[]>([])
  const [stats, setStats]             = useState<Stats | null>(null)
  const [filtroFundo, setFiltroFundo] = useState('')
  const [filtroTipo, setFiltroTipo]   = useState('')
  const [selecionado, setSelecionado] = useState<Imovel | null>(null)
  const [fundoDetalhe, setFundoDetalhe] = useState<Fundo | null>(null)
  const [imoveisFundo, setImoveisFundo] = useState<Imovel[]>([])
  const [menuAberto, setMenuAberto]   = useState(false)

  useEffect(() => {
    fetch(`${API}/fundos`).then(r => r.json()).then(setFundos)
    fetch(`${API}/tipos`).then(r => r.json()).then(d => setTipos(d.map((t: any) => t.tipo).filter(Boolean)))
    fetch(`${API}/stats`).then(r => r.json()).then(setStats)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filtroFundo) params.set('cnpj', filtroFundo)
    if (filtroTipo) params.set('tipo', filtroTipo)
    fetch(`${API}/imoveis?${params}`).then(r => r.json()).then(setImoveis)
  }, [filtroFundo, filtroTipo])

  useEffect(() => {
    if (!selecionado) return
    setFundoDetalhe(fundos.find(f => f.cnpj === selecionado.cnpj) || null)
    fetch(`${API}/fundos/${encodeURIComponent(selecionado.cnpj)}/imoveis`)
      .then(r => r.json()).then(setImoveisFundo)
  }, [selecionado])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', background: '#f8fafc' }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1000, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{ fontSize: '20px' }}>🗺️</span>
          <div>
            <strong style={{ fontSize: '15px', color: '#0f172a' }}>Mapa FIIs</strong>
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px', display: 'none' }} className="desktop-only">Imóveis de Fundos Imobiliários</span>
          </div>
          {stats && (
            <div style={{ display: 'flex', gap: '12px', marginLeft: '8px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{stats.com_coords.toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Imóveis</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{stats.total_fundos.toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Fundos</div>
              </div>
            </div>
          )}
        </div>

        {/* Botão filtros mobile */}
        <button
          onClick={() => setMenuAberto(!menuAberto)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: menuAberto ? '#f1f5f9' : 'white', cursor: 'pointer', fontSize: '13px', color: '#334155' }}>
          ⚙️ Filtros {(filtroFundo || filtroTipo) && <span style={{ background: '#2563eb', color: 'white', borderRadius: '99px', padding: '1px 6px', fontSize: '10px' }}>●</span>}
        </button>
      </div>

      {/* Painel de filtros — expansível */}
      {menuAberto && (
        <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filtroFundo} onChange={e => setFiltroFundo(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155', background: 'white', flex: 1, minWidth: '160px' }}>
            <option value=''>Todos os fundos</option>
            {fundos.map(f => <option key={f.cnpj} value={f.cnpj}>{f.nome}</option>)}
          </select>

          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155', background: 'white', flex: 1, minWidth: '160px' }}>
            <option value=''>Todos os tipos</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {(filtroFundo || filtroTipo) && (
            <button onClick={() => { setFiltroFundo(''); setFiltroTipo('') }}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b', background: 'white', cursor: 'pointer' }}>
              Limpar
            </button>
          )}

          <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>{imoveis.length} no mapa</span>
        </div>
      )}

      {/* Legenda */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '6px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', overflowX: 'auto' }}>
        {Object.entries(TIPO_CORES).map(([tipo, cor]) => (
          <div key={tipo} onClick={() => setFiltroTipo(filtroTipo === tipo ? '' : tipo)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cor }}/>
            <span style={{ fontSize: '11px', color: filtroTipo === tipo ? '#0f172a' : '#64748b', fontWeight: filtroTipo === tipo ? 600 : 400 }}>
              {tipo.replace('Imóveis para ', '').replace(' acabados', '').replace(' em construção', ' (obra)')}
            </span>
          </div>
        ))}
      </div>

      {/* Corpo */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Mapa */}
        <MapContainer center={[-15.7801, -47.9292]} zoom={5} style={{ flex: 1, height: '100%' }} zoomControl={true}>
          <TileLayer attribution='&copy; OpenStreetMap' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'/>
          <SearchControl />
          <ClusterLayer imoveis={imoveis} onSelect={(im) => { setSelecionado(im); setMenuAberto(false) }} />
        </MapContainer>

        {/* Painel lateral — ocupa tela toda no mobile */}
        {selecionado && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: 'min(340px, 100%)',
            background: 'white', borderLeft: '1px solid #e2e8f0',
            overflowY: 'auto', zIndex: 999,
            boxShadow: '-4px 0 20px rgba(0,0,0,0.08)'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>{selecionado.descricao}</div>
                <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 500,
                  background: corPorTipo(selecionado.tipo) + '18', color: corPorTipo(selecionado.tipo) }}>
                  {selecionado.tipo?.replace('Imóveis para ', '') || 'Sem tipo'}
                </div>
              </div>
              <button onClick={() => setSelecionado(null)}
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Imóvel</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '13px', color: '#334155' }}>
                <span>📍</span><span>{selecionado.endereco || '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#334155' }}>
                <span>📐</span><span>{selecionado.area_m2 ? `${Number(selecionado.area_m2).toLocaleString('pt-BR')} m²` : '—'}</span>
              </div>
            </div>

            {fundoDetalhe && (
              <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Fundo</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>{fundoDetalhe.nome}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{fundoDetalhe.cnpj}</div>
              </div>
            )}

            {imoveisFundo.length > 1 && (
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Outros imóveis do fundo ({imoveisFundo.length - 1})
                </div>
                {imoveisFundo.filter(im => im.id !== selecionado.id).map(im => (
                  <div key={im.id} onClick={() => setSelecionado(im)}
                    style={{ padding: '10px', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', border: '1px solid #e2e8f0', fontSize: '12px', color: '#334155' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <div style={{ fontWeight: 500, marginBottom: '2px' }}>{im.descricao}</div>
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>{im.endereco}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
