from flask import Flask, jsonify, render_template
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = Flask(__name__)

def get_stock_data(ticker):
    try:
        # 1. FETCH DATA
        print(f"Fetching data for {ticker}...") # Debug print
        end_date = datetime.now()
        start_date = end_date - timedelta(days=180)
        
        # 'multi_level_index=False' ensures we get simple columns like 'Close', not ('Close', 'NFLX')
        df = yf.download(ticker, start=start_date, end=end_date, progress=False, multi_level_index=False)
        
        if df.empty:
            print("Error: DataFrame is empty.")
            return None

        # Reset index so 'Date' becomes a regular column we can access
        df = df.reset_index()

        # 2. NUMPY & PANDAS ANALYSIS
        # Ensure we are working with float data
        df['Close'] = df['Close'].astype(float)

        # Calculate a 20-day Simple Moving Average (Trend)
        df['SMA_20'] = df['Close'].rolling(window=20).mean()
        
        # Calculate Standard Deviation (Volatility/Risk)
        df['Std_Dev'] = df['Close'].rolling(window=20).std()
        
        # Bollinger Bands
        df['Upper_Band'] = df['SMA_20'] + (df['Std_Dev'] * 2)
        df['Lower_Band'] = df['SMA_20'] - (df['Std_Dev'] * 2)

        # Clean data
        df.dropna(inplace=True)

        # 3. PREPARE JSON
        result = []
        for index, row in df.iterrows():
            result.append({
                'date': row['Date'].strftime('%Y-%m-%d'),
                'close': round(row['Close'], 2),
                'sma': round(row['SMA_20'], 2),
                'upper': round(row['Upper_Band'], 2),
                'lower': round(row['Lower_Band'], 2)
            })
        
        print(f"Successfully processed {len(result)} rows.")
        return result

    except Exception as e:
        print(f"PYTHON ERROR: {e}") # This prints the exact error to your terminal
        return None

# ROUTE: Serve the Frontend
@app.route('/')
def index():
    return render_template('index.html')

# ROUTE: The API Endpoint
@app.route('/api/predict/<ticker>')
def predict(ticker):
    data = get_stock_data(ticker)
    if data:
        return jsonify({'status': 'success', 'data': data, 'ticker': ticker.upper()})
    else:
        return jsonify({'status': 'error', 'message': 'Server Error or Invalid Ticker'}), 500

if __name__ == '__main__':
    # Running on port 5001 to avoid AirPlay conflict
    app.run(debug=True, port=5001)