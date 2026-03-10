import pandas as pd
import requests
import io
import os

# Códigos de club
CLUBS = ["RCVPO", "STOC", "MAZPO", "BAIPO", "VCGPO", "PORPO", "CAFPO", "PUROR", "NAOC"]

def obtener_ranking_fga():
    url_fga = "https://ranking.atletismo.gal/ranking_fga.asp"
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url_fga, headers=headers, timeout=20)
        # Forzamos la codificación para evitar caracteres raros en nombres gallegos
        response.encoding = 'utf-8' 
        
        tablas = pd.read_html(io.StringIO(response.text))
        df = max(tablas, key=len)
        
        # Filtrado flexible: buscamos el código en cualquier parte de la columna Equipo
        patron = '|'.join(CLUBS)
        df_filtrado = df[df['Equipo'].str.contains(patron, na=False, case=False)].copy()
        df_filtrado['Origen'] = 'FGA'
        return df_filtrado
    except Exception as e:
        print(f"Error: {e}")
        return pd.DataFrame()

def ejecutar():
    # Asegurar que la carpeta public existe
    os.makedirs('public', exist_ok=True)
    
    df_final = obtener_ranking_fga()
    
    # Si no hay datos, creamos un CSV con cabeceras para que Git no falle
    if df_final.empty:
        print("⚠️ No se han encontrado datos hoy. Creando archivo vacío de seguridad.")
        df_final = pd.DataFrame(columns=['Puesto', 'Marca', 'Atleta', 'Año', 'Equipo', 'Prueba', 'Fecha', 'Lugar', 'Origen'])

    df_final.to_csv('public/ranking_celta.csv', index=False, encoding='utf-8')
    print(f"✅ Archivo guardado con {len(df_final)} filas.")

if __name__ == "__main__":
    ejecutar()
