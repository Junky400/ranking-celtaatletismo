import pandas as pd
import requests
import io
import os

# Configuración de tus códigos de club
CLUBS_MASC = ["RCVPO", "STOC", "MAZPO", "BAIPO", "VCGPO", "PORPO"]
CLUBS_FEM = ["CAFPO", "PUROR", "PORPO", "VCGPO", "NAOC"]
TODOS_LOS_CODIGOS = CLUBS_MASC + CLUBS_FEM

def obtener_ranking_fga():
    print("Iniciando extracción de FGA...")
    url_fga = "https://ranking.atletismo.gal/ranking_fga.asp"
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url_fga, headers=headers, timeout=15)
        tablas = pd.read_html(io.StringIO(response.text))
        df = max(tablas, key=len)
        
        mask = df['Equipo'].str.contains('|'.join(TODOS_LOS_CODIGOS), na=False)
        df_filtrado = df[mask].copy()
        df_filtrado['Origen'] = 'FGA'
        print(f"✅ FGA: Encontrados {len(df_filtrado)} registros.")
        return df_filtrado
    except Exception as e:
        print(f"❌ Error en FGA: {e}")
        return pd.DataFrame()

def combinar_y_limpiar():
    df_fga = obtener_ranking_fga()
    
    if not df_fga.empty:
        # --- ESTO ES LO NUEVO ---
        # Nos aseguramos de que la carpeta 'public' exista
        if not os.path.exists('public'):
            os.makedirs('public')
            print("📁 Carpeta 'public' creada.")

        # Guardamos el archivo
        ruta_archivo = 'public/ranking_celta.csv'
        df_fga.to_csv(ruta_archivo, index=False, encoding='utf-8')
        
        # Verificamos si el archivo se creó realmente
        if os.path.exists(ruta_archivo):
            print(f"🚀 ARCHIVO CREADO CON ÉXITO en {ruta_archivo}")
            print(f"Tamaño del archivo: {os.path.getsize(ruta_archivo)} bytes")
        else:
            print("❌ ERROR CRÍTICO: El archivo no se guardó.")
    else:
        print("⚠️ No se encontraron datos para filtrar.")

if __name__ == "__main__":
    combinar_y_limpiar()
