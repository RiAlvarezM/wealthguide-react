import csv
from collections import defaultdict

report_path = '/Users/ricardo/Repos/WealthDashboard/wealthguide-react/local-data/Report (17).csv'
cuentas_path = '/Users/ricardo/Repos/WealthDashboard/wealthguide-react/local-data/cuentas.csv'

# Load current account balances
balances = {}
with open(cuentas_path, 'r', encoding='utf-8') as f:
    r = csv.reader(f)
    header = next(r)
    for row in r:
        if len(row) >= 5:
            cat, name, _, inc, val = row[:5]
            balances[name.strip()] = float(val.replace(',', '').strip() or 0)

# Process Report (17).csv
expenses = []
incomes = []
transfers = []

with open(report_path, 'r', encoding='utf-8', errors='ignore') as f:
    r = csv.reader(f)
    sec = None
    for row in r:
        if not row: continue
        first = row[0].strip()
        second = row[1].strip() if len(row) > 1 else ''
        if first == 'Fecha' and second == 'Categoría': sec = 'exp'; continue
        if first == 'Fecha' and second == 'Descripción': sec = 'inc'; continue
        if first == 'Categoría' and second == 'SubCategoría': sec = 'bud'; continue
        if first == 'Fecha' and second == 'Desde': sec = 'trn'; continue
        
        if sec == 'exp' and len(row) >= 5 and row[0].strip()[:4].isdigit():
            amt = float(row[3].replace(',', '').strip() or 0)
            expenses.append({
                'date': row[0].strip(),
                'category': row[1].strip(),
                'subcategory': row[2].strip() if len(row) > 2 else '',
                'amount': amt,
                'account': row[4].strip() if len(row) > 4 else '',
                'payee': row[5].strip() if len(row) > 5 else '',
                'notes': row[6].strip() if len(row) > 6 else ''
            })
        elif sec == 'inc' and len(row) >= 4 and row[0].strip()[:4].isdigit():
            amt = float(row[2].replace(',', '').strip() or 0)
            incomes.append({
                'date': row[0].strip(),
                'desc': row[1].strip(),
                'amount': amt,
                'account': row[3].strip() if len(row) > 3 else '',
                'notes': row[4].strip() if len(row) > 4 else ''
            })
        elif sec == 'trn' and len(row) >= 4 and row[0].strip()[:4].isdigit():
            amt = float(row[3].replace(',', '').strip() or 0)
            transfers.append({
                'date': row[0].strip(),
                'from': row[1].strip(),
                'to': row[2].strip() if len(row) > 2 else '',
                'amount': amt,
                'notes': row[4].strip() if len(row) > 4 else ''
            })

# Map investment vehicles
# Vehicles:
# 1. Paullier Online
# 2. Charles Schwab
# 3. Profuturo
# 4. Fortesza
# 5. Interactive Brokers
# 6. EDIOACC (Jubilación + Aportes + Plazo Fijo)
# 7. BAC-Objetivo / Mi Meta
# 8. Progreso
# 9. Criptomonedas / QuAI
# 10. Copa - Fondo

vehicles = {
    'Paullier Online': {
        'exp_sub': ['Paullier'],
        'inc_desc': ['Paullier'],
        'balance_keys': ['Paullier Online'],
        'notes': 'Broker internacional / acciones'
    },
    'Charles Schwab': {
        'exp_sub': ['Schwab'],
        'inc_desc': ['Schwab'],
        'balance_keys': ['Charles Schwab', 'Schwab'],
        'notes': 'Broker internacional USA (ETFs/Acciones: VOOG, SCHX, etc.)'
    },
    'Profuturo': {
        'exp_sub': ['Jubilación Profuturo'],
        'inc_desc': ['Profuturo'],
        'balance_keys': ['Profuturo - R.A.'],
        'notes': 'Fondo de pensión voluntario'
    },
    'Fortesza': {
        'exp_sub': ['Fortesza'],
        'inc_desc': ['Fortesza'],
        'balance_keys': ['Fortesza RA', 'Fortesza GG'],
        'notes': 'Crowdfactoring / Facturas negociables'
    },
    'Interactive Brokers': {
        'exp_sub': ['Interactive brokers'],
        'inc_desc': ['Interactive brokers', 'IBKR'],
        'balance_keys': ['Interactive Brokers'],
        'notes': 'Broker internacional USA'
    },
    'EDIOACC (Jubilación & Aportes)': {
        'exp_sub': ['Jubilación EDIOACC', 'Aportes EDIOACC'],
        'inc_desc': ['EDIOACC', 'Edioacc'],
        'balance_keys': ['EDIOACC - Jubilación R.A.', 'EDIOACC - Jubilación G.G.', 'EDIOACC - Aportes R.A.', 'EDIOACC - Aportes G.G.', 'EDIOACC Plazo Fijo'],
        'notes': 'Cooperativa de ahorro y crédito / Jubilación'
    },
    'BAC Objetivo / Mi Meta': {
        'exp_sub': ['Objetivo BAC', 'Mi Meta'],
        'inc_desc': ['Objetivo BAC', 'Mi Meta'],
        'balance_keys': ['BAC-Objetivo'],
        'notes': 'Cuentas de ahorro programado a término'
    },
    'Progreso': {
        'exp_sub': ['Progreso'],
        'inc_desc': ['Progreso'],
        'balance_keys': ['Progreso'],
        'notes': 'Fondo de cesantía / jubilación'
    },
    'Criptomonedas / QuAI / MMG': {
        'exp_sub': ['Criptomonedas', 'QuAI', 'MMG'],
        'inc_desc': ['Quantia', 'Cripto'],
        'balance_keys': ['Criptos', 'Quantia Inversiones'],
        'notes': 'Criptoactivos y fintechs'
    },
    'Ahorro Copa': {
        'exp_sub': ['Ahorro Copa'],
        'inc_desc': ['Copa XIII'],
        'balance_keys': ['Copa - Fondo'],
        'notes': 'Fondo de empleados / ahorro laboral'
    }
}

print("=== DETAILED INVESTMENT PERFORMANCE ===")
results = []
for name, v in vehicles.items():
    # Expenses (Injections/Purchases)
    exp_matches = [e for e in expenses if e['category'] == 'Inversion' and any(sub.lower() in e['subcategory'].lower() for sub in v['exp_sub'])]
    total_injected = sum(e['amount'] for e in exp_matches)
    
    # Incomes (Withdrawals/Sales/Distributions)
    inc_matches = [i for i in incomes if any(d.lower() == i['desc'].lower() or d.lower() in i['desc'].lower() for d in v['inc_desc'])]
    total_withdrawn = sum(i['amount'] for i in inc_matches)
    
    # Current Value
    curr_val = sum(balances.get(k, 0.0) for k in v['balance_keys'])
    
    # Net Profit = Total Withdrawn + Current Value - Total Injected
    net_profit = total_withdrawn + curr_val - total_injected
    roi = (net_profit / total_injected * 100) if total_injected > 0 else 0.0
    
    results.append({
        'name': name,
        'injected': total_injected,
        'injected_txs': len(exp_matches),
        'withdrawn': total_withdrawn,
        'withdrawn_txs': len(inc_matches),
        'curr_val': curr_val,
        'net_profit': net_profit,
        'roi': roi
    })

for r in results:
    print(f"\n{r['name']}:")
    print(f"  Compras / Aportes (Total Inyectado):  ${r['injected']:10,.2f} ({r['injected_txs']} txs)")
    print(f"  Ventas / Retiros / Ingresos:           ${r['withdrawn']:10,.2f} ({r['withdrawn_txs']} txs)")
    print(f"  Valor Actual en Cartera:               ${r['curr_val']:10,.2f}")
    print(f"  Beneficio Neto (Ganancia/Pérdida):     ${r['net_profit']:10,.2f}")
    print(f"  Rentabilidad Acumulada (ROI):           {r['roi']:6.2f}%")

total_inv_injected = sum(r['injected'] for r in results)
total_inv_withdrawn = sum(r['withdrawn'] for r in results)
total_inv_curr_val = sum(r['curr_val'] for r in results)
total_inv_profit = total_inv_withdrawn + total_inv_curr_val - total_inv_injected
total_inv_roi = (total_inv_profit / total_inv_injected * 100) if total_inv_injected > 0 else 0

print("\n================ TOTAL INVERSIONES ================")
print(f"  Total Inyectado (Compras/Aportes):     ${total_inv_injected:12,.2f}")
print(f"  Total Retirado/Vendido/Rendimientos:   ${total_inv_withdrawn:12,.2f}")
print(f"  Valor Actual Total en Cartera:         ${total_inv_curr_val:12,.2f}")
print(f"  Ganancia Neta Total Generada:          ${total_inv_profit:12,.2f}")
print(f"  ROI Global Acumulado:                   {total_inv_roi:6.2f}%")
