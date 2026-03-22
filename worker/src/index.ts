import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

// Lista todos os fundos
app.get('/fundos', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT cnpj, nome FROM fundos ORDER BY nome'
  ).all()
  return c.json(results)
})

// Imóveis no viewport do mapa (bounding box)
app.get('/imoveis', async (c) => {
  const { minLat, maxLat, minLon, maxLon, tipo, cnpj } = c.req.query()

  let sql = `
    SELECT i.id, i.descricao, i.endereco, i.cidade, i.estado,
           i.tipo, i.area_m2, i.lat, i.lon, f.nome as fundo_nome, f.cnpj
    FROM imoveis i
    JOIN fundos f ON f.cnpj = i.cnpj_fundo
    WHERE i.lat IS NOT NULL
  `
  const params: any[] = []

  if (minLat && maxLat && minLon && maxLon) {
    sql += ' AND i.lat BETWEEN ? AND ? AND i.lon BETWEEN ? AND ?'
    params.push(minLat, maxLat, minLon, maxLon)
  }
  if (tipo) {
    sql += ' AND i.tipo = ?'
    params.push(tipo)
  }
  if (cnpj) {
    sql += ' AND i.cnpj_fundo = ?'
    params.push(cnpj)
  }

  sql += ' LIMIT 500'

  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(results)
})

// Imóveis de um fundo específico
app.get('/fundos/:cnpj/imoveis', async (c) => {
  const cnpj = c.req.param('cnpj')
  const { results } = await c.env.DB.prepare(`
    SELECT i.*, f.nome as fundo_nome
    FROM imoveis i
    JOIN fundos f ON f.cnpj = i.cnpj_fundo
    WHERE i.cnpj_fundo = ?
  `).bind(cnpj).all()
  return c.json(results)
})

// Tipos de imóveis disponíveis
app.get('/tipos', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT DISTINCT tipo FROM imoveis WHERE tipo IS NOT NULL ORDER BY tipo'
  ).all()
  return c.json(results)
})

export default app

app.get('/stats', async (c) => {
  const [imoveis, fundos, coords] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as total FROM imoveis').first<{total:number}>(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM fundos').first<{total:number}>(),
    c.env.DB.prepare('SELECT COUNT(*) as total FROM imoveis WHERE lat IS NOT NULL').first<{total:number}>(),
  ])
  return c.json({
    total_imoveis: imoveis?.total || 0,
    total_fundos: fundos?.total || 0,
    com_coords: coords?.total || 0,
  })
})

