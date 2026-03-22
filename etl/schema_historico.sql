CREATE TABLE IF NOT EXISTS historico_portfolio (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cnpj_fundo      TEXT NOT NULL,
  data_referencia TEXT NOT NULL,
  total_imoveis   INTEGER,
  area_total      REAL,
  UNIQUE(cnpj_fundo, data_referencia)
);
CREATE INDEX IF NOT EXISTS idx_historico_cnpj ON historico_portfolio(cnpj_fundo);
CREATE INDEX IF NOT EXISTS idx_historico_data ON historico_portfolio(data_referencia);
