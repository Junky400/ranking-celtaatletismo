import pandas as pd
import requests
import io

# Configuración de tus códigos de club
CLUBS_MASC = ["RCVPO", "STOC", "MAZPO", "BAIPO", "VCGPO", "PORPO"]
CLUBS_FEM = ["CAFPO", "PUROR", "PORPO", "VCGPO", "NAOC"]
TODOS_LOS_CODIGOS = CLUBS_MASC + CLUBS_FEM

def obtener_ranking_fga():
    print("Iniciando extracción de FGA por códigos...")
    url_fga = "https://ranking.atletismo.gal/ranking_fga.asp"
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url_fga, headers=headers)
        # Usamos StringIO para que Pandas no de advertencias
        tablas = pd.read_html(io.StringIO(response.text))
        df = max(tablas, key=len)
        
        # Filtramos: buscamos los códigos en la columna 'Equipo'
        mask = df['Equipo'].str.contains('|'.join(TODOS_LOS_CODIGOS), na=False)
        df_filtrado = df[mask].copy()
        df_filtrado['Origen'] = 'FGA'
        return df_filtrado
    except Exception as e:
        print(f"❌ Error en FGA: {e}")
        return pd.DataFrame()

def obtener_ranking_rfea():
    # Este bloque lo ampliaremos más adelante para conectar con la RFEA
    print("Iniciando extracción de RFEA (Próxima fase)...")
    return pd.DataFrame()

def combinar_y_limpiar():
    df_fga = obtener_ranking_fga()
    df_rfea = obtener_ranking_rfea()
    
    df_final = pd.concat([df_fga, df_rfea], ignore_index=True)
    
    if not df_final.empty:
        # Eliminamos duplicados exactos
        df_final = df_final.drop_duplicates(subset=['Atleta', 'Prueba', 'Marca'], keep='first')
        
        # IMPORTANTE: Guardamos en 'public/' para que la App lo encuentre
        df_final.to_csv('public/ranking_celta.csv', index=False, encoding='utf-8')
        print(f"🚀 Archivo generado con {len(df_final)} registros.")
    else:
        print("⚠️ No se encontraron datos hoy.")

if __name__ == "__main__":
    combinar_y_limpiar()
