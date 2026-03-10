import pandas as pd
import requests
import io
import os

# Códigos de club según tu captura
CLUBS = ["RCVPO", "STOC", "MAZPO", "BAIPO", "VCGPO", "PORPO", "CAFPO", "PUROR", "NAOC"]

def extraer_fga_por_sexo(sexo_id):
    """sexo_id: 1 para Masculino, 2 para Feminino"""
    tipo_sexo = "Masculino" if sexo_id == 1 else "Femenino"
    print(f"Extrayendo ranking completo {tipo_sexo}...")
    
    url = "https://ranking.atletismo.gal/ranking_fga.asp"
    
    # Payload exacto para obtener "Ranking Completo" de la temporada 2026
    payload = {
        'temp': '2026',
        'sexo': str(sexo_id),
        'tpo': '0',       # 0 es 'Ranking Completo'
        'cat': '0',       # Todas las categorías
        'pista': '0',     # Aire libre / Pista Cubierta
        'n_atl': '0',     # 0 suele ser 'Todos' en este tipo de webs
        'btnConsultar': 'Consultar'
    }

    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.post(url, data=payload, headers=headers, timeout=60)
        response.encoding = 'utf-8'
        
        tablas = pd.read_html(io.StringIO(response.text))
        if not tablas:
            return pd.DataFrame()
            
        df = max(tablas, key=len)
        
        # Filtrar por tus clubes
        patron = '|'.join(CLUBS)
        # Usamos la columna 'Equipo' que se ve en tu captura
        df_filtrado = df[df['Equipo'].astype(str).str.contains(patron, na=False)].copy()
        
        print(f"✅ {tipo_sexo}: Encontrados {len(df_filtrado)} atletas de tus clubes.")
        return df_filtrado
    except Exception as e:
        print(f"❌ Error en {tipo_sexo}: {e}")
        return pd.DataFrame()

def ejecutar():
    os.makedirs('public', exist_ok=True)
    
    # 1. Obtener Masculino
    df_masc = extraer_fga_por_sexo(1)
    # 2. Obtener Femenino
    df_fem = extraer_fga_por_sexo(2)
    
    # Unir ambos rankings
    df_final = pd.concat([df_masc, df_fem], ignore_index=True)
    
    if not df_final.empty:
        # Renombrar columnas si es necesario para que coincidan con tu App
        # Según tu captura las columnas son: #, Marca, Pto., Atleta, Equipo, Data, Lugar
        df_final['Origen'] = 'FGA'
        
        ruta = 'public/ranking_celta.csv'
        df_final.to_csv(ruta, index=False, encoding='utf-8')
        print(f"🚀 PROCESO COMPLETADO: {len(df_final)} registros guardados en {ruta}")
    else:
        print("⚠️ No se encontraron datos. Revisa si la web de la FGA está caída o los parámetros cambiaron.")
        # Generar CSV vacío con cabeceras para que la App no rompa
        pd.DataFrame(columns=['Marca', 'Atleta', 'Equipo', 'Data', 'Lugar', 'Origen']).to_csv('public/ranking_celta.csv', index=False)

if __name__ == "__main__":
    ejecutar()
