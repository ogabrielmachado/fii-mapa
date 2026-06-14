
import os
import io
import math
import time
import zipfile
import requests
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

CF_ACCOUNT_ID  = os.getenv("CF_ACCOUNT_ID")
CF_API_TOKEN   = os.getenv("CF_API_TOKEN")
CF_DATABASE_ID = os.getenv("CF_DATABASE_ID")
GOOGLE_MAPS_KEY = os.getenv("GOOGLE_MAPS_KEY")
CF_D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/d1/database/{CF_DATABASE_ID}/query"

HEADERS = {
    "Authorization": f"Bearer {CF_API_TOKEN}",
    "Content-Type": "application/json",
}

ANO_DADOS = 2025
LOTE_IMOVEIS = 5

def clean(val):
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    s = str(val).strip()
    return None if s.lower() in ("nan", "none", "") else s

def safe_float(val):
    try:
        v = str(val).replace(",", ".").strip()
        return None if v.lower() in ("nan", "none", "") else float(v)
    except:
        return None

def d1_query(sql, params=[]):
    clean_params = [None if isinstance(p, float) and math.isnan(p) else p for p in params]
    res = requests.post(CF_D1_URL, headers=HEADERS, json={"sql": sql, "params": clean_params})
    if not res.ok:
        print(f"  ERRO HTTP {res.status_code}: {res.text[:300]}")
        return None
    data = res.json()
    if not data.get("success"):
        print(f"  ERRO D1: {data.get('errors')}")
        return None
    return data

def geocode(endereco):
    """Google Maps Geocoding API — muito mais preciso para endereços brasileiros."""
    try:
        r = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={
                "address": endereco + ", Brasil",
                "key": GOOGLE_MAPS_KEY,
                "region": "br",
                "language": "pt-BR",
            },
            timeout=10,
        )
        data = r.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return float(loc["lat"]), float(loc["lng"])
        else:
            print(f"    Status: {data.get('status')}")
    except Exception as e:
        print(f"    Erro geocode: {e}")
    return None, None

def baixar_dados():
    url = f"https://dados.cvm.gov.br/dados/FII/DOC/INF_TRIMESTRAL/DADOS/inf_trimestral_fii_{ANO_DADOS}.zip"
    print(f"Baixando {url}...")
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        df_imoveis = pd.read_csv(z.open(f"inf_trimestral_fii_imovel_{ANO_DADOS}.csv"), sep=";", encoding="latin-1", dtype=str)
        df_geral   = pd.read_csv(z.open(f"inf_trimestral_fii_geral_{ANO_DADOS}.csv"),  sep=";", encoding="latin-1", dtype=str)
    print(f"Imóveis: {len(df_imoveis)} | Fundos: {len(df_geral)}")
    return df_imoveis, df_geral

def extrair_cidade_estado(endereco):
    cidade, estado = None, None
    try:
        if " - " in endereco:
            partes = endereco.rsplit(" - ", 1)
            uf = partes[1].strip()
            estado = uf[:2] if len(uf) >= 2 else uf
            segmentos = partes[0].split(",")
            if len(segmentos) >= 2:
                cidade = segmentos[-1].strip()
    except:
        pass
    return cidade, estado

def inserir_fundos_lote(fundos_map):
    items = [(cnpj.strip(), nome.strip()) for cnpj, nome in fundos_map.items() if cnpj]
    total = len(items)
    for i in range(0, total, LOTE_IMOVEIS):
        lote = items[i:i+LOTE_IMOVEIS]
        placeholders = ", ".join(["(?, ?, ?)" for _ in lote])
        params = []
        for cnpj, nome in lote:
            params += [cnpj, nome, datetime.now().isoformat()]
        d1_query(f"INSERT OR REPLACE INTO fundos (cnpj, nome, updated_at) VALUES {placeholders}", params)
    print(f"  {total} fundos inseridos")

def inserir_imoveis_lote(lote):
    """Insere um lote de imóveis numa única chamada ao D1."""
    if not lote:
        return
    placeholders = ", ".join(["(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)" for _ in lote])
    params = []
    for row in lote:
        params += [
            row["cnpj_fundo"], row["descricao"], row["endereco"],
            row["cidade"], row["estado"], row["tipo"],
            row["area_m2"], None,
            row["lat"], row["lon"],
            datetime.now().isoformat(),
        ]
    sql = f"""INSERT INTO imoveis
        (cnpj_fundo, descricao, endereco, cidade, estado, tipo, area_m2, valor_contabil, lat, lon, updated_at)
        VALUES {placeholders}"""
    d1_query(sql, params)

def buscar_ja_inseridos():
    res = d1_query("SELECT cnpj_fundo || '|' || descricao as chave FROM imoveis")
    if res and res.get("result"):
        rows = res["result"][0].get("results", [])
        return set(r["chave"] for r in rows)
    return set()

def main():
    df_imoveis, df_geral = baixar_dados()

    fundos_map = dict(zip(
        df_geral["CNPJ_Fundo_Classe"].str.strip(),
        df_geral["Nome_Fundo_Classe"].str.strip()
    ))

    df_imoveis["Data_Referencia"] = pd.to_datetime(df_imoveis["Data_Referencia"], errors="coerce")
    df_imoveis = df_imoveis.sort_values("Data_Referencia", ascending=False)
    df_imoveis = df_imoveis.drop_duplicates(subset=["CNPJ_Fundo_Classe", "Nome_Imovel"])

    print(f"Total de imóveis únicos: {len(df_imoveis)}\n")

    print("Inserindo fundos...")
    inserir_fundos_lote(fundos_map)

    print("\nVerificando imóveis já inseridos...")
    ja_inseridos = buscar_ja_inseridos()
    print(f"  Já no banco: {len(ja_inseridos)}\n")

    total = len(df_imoveis)
    inseridos = 0
    pulados = 0
    sem_coords = 0
    lote_atual = []

    for i, (_, row) in enumerate(df_imoveis.iterrows()):
        cnpj  = clean(row.get("CNPJ_Fundo_Classe"))
        nome  = clean(row.get("Nome_Imovel"))
        ender = clean(row.get("Endereco"))
        tipo  = clean(row.get("Classe"))
        area  = safe_float(row.get("Area"))

        if not cnpj or not nome:
            continue

        chave = f"{cnpj}|{nome}"
        if chave in ja_inseridos:
            pulados += 1
            continue

        cidade, estado = extrair_cidade_estado(ender or "")

        lat, lon = None, None
        if ender:
            print(f"[{i+1}/{total}] {nome[:50]}")
            print(f"  {ender[:70]}")
            lat, lon = geocode(ender)
            if lat:
                print(f"  ✓ {lat:.4f}, {lon:.4f}")
            else:
                print(f"  ✗ sem coordenadas")
                sem_coords += 1

        lote_atual.append({
            "cnpj_fundo": cnpj, "descricao": nome,
            "endereco": ender, "cidade": cidade, "estado": estado,
            "tipo": tipo, "area_m2": area,
            "lat": lat, "lon": lon,
        })
        inseridos += 1

        # Envia lote quando cheio
        if len(lote_atual) >= LOTE_IMOVEIS:
            inserir_imoveis_lote(lote_atual)
            lote_atual = []
            print(f"  → Lote inserido no banco")

        if inseridos % 100 == 0:
            print(f"\n--- {inseridos}/{total} inseridos | {sem_coords} sem coords ---\n")

    # Insere o restante
    if lote_atual:
        inserir_imoveis_lote(lote_atual)

    print(f"\n✅ ETL concluído!")
    print(f"   Inseridos: {inseridos} | Pulados: {pulados} | Sem coords: {sem_coords}")

if __name__ == "__main__":
    main()
