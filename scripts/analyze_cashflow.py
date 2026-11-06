import csv
from collections import defaultdict

report_path = '/Users/ricardo/Repos/WealthDashboard/wealthguide-react/local-data/Report (17).csv'

incomes = []
expenses = []

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

# Salaries by employer
print("=== SALARIES BY EMPLOYER ===")
emp_sal = defaultdict(lambda: {'total': 0.0, 'by_year': defaultdict(float), 'tx_count': 0})

salary_keys = {
    'ACP': ['acp'],
    'Copa Airlines': ['copa'],
    'UTP': ['utp'],
    'Aguinaldos / Bonos': ['aguinaldo', 'licencia', 'beca', 'defensas']
}

for inc in incomes:
    d_lower = inc['desc'].lower()
    y = inc['date'][:4]
    matched = False
    for emp, keys in salary_keys.items():
        if any(k == d_lower or (k in d_lower and k not in ['copa xiii']) for k in keys):
            emp_sal[emp]['total'] += inc['amount']
            emp_sal[emp]['by_year'][y] += inc['amount']
            emp_sal[emp]['tx_count'] += 1
            matched = True
            break

for emp, d in sorted(emp_sal.items(), key=lambda x: x[1]['total'], reverse=True):
    print(f"\n{emp}: Total ${d['total']:12,.2f} ({d['tx_count']} txs)")
    for y in sorted(d['by_year'].keys()):
        print(f"  {y}: ${d['by_year'][y]:10,.2f}")

# Recent months (2025 - 2026) cash flow analysis
print("\n=== MONTHLY CASH FLOW (2025 - 2026) ===")
months = sorted(list(set([e['date'][:7] for e in expenses if e['date'] >= '2025-01'] + [i['date'][:7] for i in incomes if i['date'] >= '2025-01'])))

for m in months:
    m_inc = [i for i in incomes if i['date'][:7] == m]
    m_exp = [e for e in expenses if e['date'][:7] == m]
    
    tot_inc = sum(i['amount'] for i in m_inc)
    
    sal = sum(i['amount'] for i in m_inc if any(k in i['desc'].lower() for k in ['acp', 'copa', 'utp', 'aguinaldo']))
    inv_inc = sum(i['amount'] for i in m_inc if any(k in i['desc'].lower() for k in ['profuturo', 'paullier', 'schwab', 'fortesza', 'interes', 'plazo fijo', 'dividendo']))
    rent = sum(i['amount'] for i in m_inc if 'alquiler' in i['desc'].lower())
    other_inc = tot_inc - sal - inv_inc - rent
    
    tot_exp = sum(e['amount'] for e in m_exp)
    inv_exp = sum(e['amount'] for e in m_exp if 'invers' in e['category'].lower())
    living_exp = tot_exp - inv_exp
    
    # Net Operational Cash Flow = (Salary + Rental + Other Operating) - Living Expenses
    op_inflows = sal + rent + other_inc
    op_cashflow = op_inflows - living_exp
    
    # Free Cash Flow after investments
    total_net = tot_inc - tot_exp
    
    print(f"{m} | Ingresos: ${tot_inc:8,.2f} (Sal: ${sal:7,.2f}, Rent: ${rent:6,.2f}, Inv: ${inv_inc:7,.2f}) | Gastos Vida: ${living_exp:8,.2f} | Inversión: ${inv_exp:7,.2f} | Flujo Operativo: ${op_cashflow:8,.2f} | Flujo Neto: ${total_net:8,.2f}")
