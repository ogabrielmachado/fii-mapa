CREATE TABLE IF NOT EXISTS fundos (
  cnpj        TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  ticker      TEXT,
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS imoveis (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cnpj_fundo      TEXT NOT NULL,
  descricao       TEXT,
  endereco        TEXT,
  cidade          TEXT,
  estado          TEXT,
  tipo            TEXT,
  area_m2         REAL,
  valor_contabil  REAL,
  lat             REAL,
  lon             REAL,
  updated_at      TEXT,
  FOREIGN KEY (cnpj_fundo) REFERENCES fundos(cnpj)
);

CREATE INDEX IF NOT EXISTS idx_imoveis_cnpj ON imoveis(cnpj_fundo);
CREATE INDEX IF NOT EXISTS idx_imoveis_estado ON imoveis(estado);
CREATE INDEX IF NOT EXISTS idx_imoveis_tipo ON imoveis(tipo);
CREATE INDEX IF NOT EXISTS idx_imoveis_latlon ON imoveis(lat, lon);