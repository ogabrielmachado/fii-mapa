import os
import re
import io
import math
import zipfile
import requests
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

CF_ACCOUNT_ID  = os.getenv("CF_ACCOUNT_ID")
CF_API_TOKEN   = os.getenv("CF_API_TOKEN")
CF_DATABASE_ID = os.getenv("CF_DATABASE_ID")
CF_D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_DATABASE_ID}/query"

HEADERS = {
    "Authorization": f"Bearer {CF_API_TOKEN}",
    "Content-Type": "application/json",
}

ANOS = list(range(2016, datetime.now().year + 1))

def d1_query(sql, params=[]):
    clean_params = [None if isinstance(p, float) and math.isnan(p) else p for p in params]
    res = requests.post(CF_D1_URL, headers=HEADERS, json={"sql": sql, "params": clean_params})
    if not res.ok:
        print(f"  ERRO {res.status_code}: {res.text[:200]}")
        return None
    data = res.json()
    if not data.get("success"):
        print(f"  ERRO D1: {data.get('errors')}")
        return None
    return data

def inserir_lote(lote):
    if not lote:
        return
    placeholders = ", ".join(["(?, ?, ?, ?)" for _ in lote])
    params = []
    for row in lote:
        params += [row["cnpj"], row["data"], row["total"], row["area"]]
    sql = f"""INSERT OR REPLACE INTO historico_portfolio
        (cnpj_fundo, data_referencia, total_imoveis, area_total)
        VALUES {placeholders}"""
    d1_query(sql, params)

def processar_ano(ano):
    url = f"https://dados.cvm.gov.br/dados/FII/DOC/INF_TRIMESTRAL/DADOS/inf_trimestral_fii_{ano}.zip"
    print(f"\nBaixando {ano}...")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
    except Exception as e:
        print(f"  Erro ao baixar {ano}: {e}")
        return

    try:
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            arquivos = z.namelist()
            nome_imovel = next((a for a in arquivos if re.match(rf"inf_trimestral_fii_imovel_{ano}\.csv", a)), None)
            if not nome_imovel:
                nome_imovel = next((a for a in arquivos if "imovel" in a.lower() and "alienacao" not in a.lower() and "aquisicao" not in a.lower() and "desempenho" not in a.lower() and "renda" not in a.lower() and "contrato" not in a.lower() and "inquilino" not in a.lower() and a.endswith(".csv")), None)
            if not nome_imovel:
                print(f"  Arquivo de imóveis não encontrado para {ano}. Arquivos: {arquivos}")
                return
            print(f"  Usando: {nome_imovel}")
            df = pd.read_csv(z.open(nome_imovel), sep=";", encoding="latin-1", dtype=str)
    except Exception as e:
        print(f"  Erro ao processar ZIP {ano}: {e}")
        return

    # Detecta colunas (formato mudou ao longo dos anos)
    cnpj_col  = next((c for c in df.columns if "CNPJ" in c.upper() and "FUNDO" in c.upper()), None)
    data_col  = next((c for c in df.columns if "DATA" in c.upper() and "REF" in c.upper()), None)
    area_col  = next((c for c in df.columns if "AREA" in c.upper() or "QT_AREA" in c.upper()), None)

    if not cnpj_col or not data_col:
        print(f"  Colunas não encontradas: {list(df.columns)[:5]}")
        return

    print(f"  {len(df)} registros | colunas: {cnpj_col}, {data_col}, {area_col}")

    # Agrupa por fundo + trimestre
    df["_cnpj"] = df[cnpj_col].str.strip()
    df["_data"] = df[data_col].str.strip()

    if area_col:
        df["_area"] = pd.to_numeric(df[area_col].str.replace(",", "."), errors="coerce")
    else:
        df["_area"] = 0.0

    agrupado = df.groupby(["_cnpj", "_data"]).agg(
        total_imoveis=("_cnpj", "count"),
        area_total=("_area", "sum")
    ).reset_index()

    lote = []
    for _, row in agrupado.iterrows():
        lote.append({
            "cnpj": row["_cnpj"],
            "data": row["_data"],
            "total": int(row["total_imoveis"]),
            "area": float(row["area_total"]) if not math.isnan(row["area_total"]) else 0.0,
        })
        if len(lote) >= 10:
            inserir_lote(lote)
            lote = []

    if lote:
        inserir_lote(lote)

    print(f"  ✓ {len(agrupado)} registros inseridos para {ano}")

def main():
    print(f"Processando histórico de {ANOS[0]} a {ANOS[-1]}...")
    for ano in ANOS:
        processar_ano(ano)
    print("\n✅ Histórico concluído!")

if __name__ == "__main__":
    main()
