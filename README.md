# 🗺️ Mapa FIIs

Mapa interativo dos imóveis de Fundos de Investimento Imobiliário (FIIs) listados na bolsa brasileira.

**Acesse:** [fii-mapa.pages.dev](https://fii-mapa.pages.dev)

## O que é

Uma ferramenta de visualização que mostra no mapa todos os imóveis físicos que compõem os FIIs brasileiros — galpões logísticos, lajes corporativas, shoppings, hospitais e muito mais. Os dados são extraídos diretamente dos informes trimestrais obrigatórios enviados à CVM.

## Funcionalidades

- 🗺️ Mapa interativo com todos os imóveis dos FIIs
- 🎨 Pins coloridos por tipo de imóvel
- 🔵 Clustering automático de pins próximos
- 🔍 Busca por endereço
- 📋 Painel lateral com detalhes do imóvel e do fundo
- 📱 Layout responsivo para mobile
- 🔄 Atualização automática semanal dos dados

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Dados | CVM — Informe Trimestral de FII |
| ETL | Python + pandas |
| Geocodificação | Google Maps Geocoding API |
| Banco | Cloudflare D1 (SQLite) |
| API | Cloudflare Workers + Hono.js |
| Frontend | React + Vite + Leaflet |
| Deploy | Cloudflare Pages |
| Scheduler | GitHub Actions (cron semanal) |

## Arquitetura
```
CVM (ZIP) → ETL Python → Geocoding → D1 Database → Workers API → React Frontend
                ↑
         GitHub Actions
         (toda segunda)
```

## Estrutura do projeto
```
fii-mapa/
├── etl/                  # Pipeline de dados
│   ├── main.py           # Script principal
│   └── requirements.txt
├── worker/               # API (Cloudflare Workers)
│   └── src/
│       └── index.ts      # Endpoints Hono.js
├── frontend/             # Interface web
│   └── src/
│       └── App.tsx       # Componente principal
└── .github/
    └── workflows/
        └── etl.yml       # Atualização semanal
```

## Como rodar localmente

### Pré-requisitos
- Node.js 18+
- Python 3.10+
- Conta na Cloudflare
- Chave da Google Maps Geocoding API

### ETL
```bash
cd etl
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # preencha com suas credenciais
python3 main.py
```

### Worker (API)
```bash
cd worker
npm install
wrangler dev --remote
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Variáveis de ambiente

Crie um arquivo `etl/.env` com:
```
CF_ACCOUNT_ID=seu_account_id
CF_API_TOKEN=seu_api_token
CF_DATABASE_ID=seu_database_id
GOOGLE_MAPS_KEY=sua_chave_google
```

## Fonte dos dados

Os dados são públicos e disponibilizados pela CVM:
- [Informe Trimestral de FII](https://dados.cvm.gov.br/dataset/fii-doc-inf_trimestral)
- Atualizado semanalmente pela CVM
- Licença: ODbL (Open Data Commons)

## Licença

MIT
