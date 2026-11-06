import csv
from collections import defaultdict
import datetime

path = '/Users/ricardo/Repos/WealthDashboard/wealthguide-react/local-data/Report (17).csv'

def clean_num(val):
    if not val: return 0.0
    v = val.replace(',', '').strip()
    try: return float(v)
    except: return 0.0

expenses = []
incomes = []
budgets = []
transfers = []

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
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
            expenses.append({
                'date': row[0].strip(),
                'category': row[1].strip(),
                'subcategory': row[2].strip() if len(row) > 2 else '',
                'amount': clean_num(row[3]),
                'account': row[4].strip() if len(row) > 4 else '',
                'payee': row[5].strip() if len(row) > 5 else '',
                'notes': row[6].strip() if len(row) > 6 else ''
            })
        elif sec == 'inc' and len(row) >= 4 and row[0].strip()[:4].isdigit():
            incomes.append({
                'date': row[0].strip(),
                'desc': row[1].strip(),
                'amount': clean_num(row[2]),
                'account': row[3].strip() if len(row) > 3 else '',
                'notes': row[4].strip() if len(row) > 4 else ''
            })
        elif sec == 'bud' and len(row) >= 5:
            budgets.append({
                'category': row[0].strip(),
                'subcategory': row[1].strip(),
                'budget': clean_num(row[2]),
                'spent': clean_num(row[3]),
                'balance': clean_num(row[4])
            })
        elif sec == 'trn' and len(row) >= 4 and row[0].strip()[:4].isdigit():
            transfers.append({
                'date': row[0].strip(),
                'from': row[1].strip(),
                'to': row[2].strip() if len(row) > 2 else '',
                'amount': clean_num(row[3]),
                'notes': row[4].strip() if len(row) > 4 else ''
            })

print(f"Loaded: {len(expenses)} expenses, {len(incomes)} incomes, {len(transfers)} transfers, {len(budgets)} budgets.")

# Print subcategories of Inversion
print("\n=== SUB-CATEGORIES OF 'Inversion' EXPENSES ===")
inv_subs = defaultdict(lambda: [0.0, 0])
for e in expenses:
    if 'invers' in e['category'].lower():
        inv_subs[e['subcategory']][0] += e['amount']
        inv_subs[e['subcategory']][1] += 1

for sub, (amt, cnt) in sorted(inv_subs.items(), key=lambda x: x[1][0], reverse=True):
    print(f"  {sub:35s}: ${amt:12,.2f} ({cnt} txs)")

# All accounts
print("\n=== ALL ACCOUNTS INVOLVED ===")
accounts = set()
for e in expenses: accounts.add(e['account'])
for i in incomes: accounts.add(i['account'])
for t in transfers: accounts.add(t['from']); accounts.add(t['to'])
for a in sorted(accounts):
    print(f"  {a}")

# Let's inspect transfers summary
print("\n=== TRANSFERS SUMMARY PER ACCOUNT ===")
transfer_summary = defaultdict(lambda: {'in': 0.0, 'out': 0.0, 'in_cnt': 0, 'out_cnt': 0})
for t in transfers:
    transfer_summary[t['from']]['out'] += t['amount']
    transfer_summary[t['from']]['out_cnt'] += 1
    transfer_summary[t['to']]['in'] += t['amount']
    transfer_summary[t['to']]['in_cnt'] += 1

for acc, d in sorted(transfer_summary.items(), key=lambda x: (x[1]['in'] + x[1]['out']), reverse=True):
    net_trn = d['in'] - d['out']
    print(f"  {acc:35s} | In: ${d['in']:10,.2f} | Out: ${d['out']:10,.2f} | Net: ${net_trn:10,.2f}")

# Yearly breakdown of Incomes, Expenses, Inversion Expenses, Living Expenses
print("\n=== YEARLY BREAKDOWN ===")
years = sorted(list(set([e['date'][:4] for e in expenses] + [i['date'][:4] for i in incomes])))

for y in years:
    y_exp = [e for e in expenses if e['date'][:4] == y]
    y_inc = [i for i in incomes if i['date'][:4] == y]
    
    total_exp = sum(e['amount'] for e in y_exp)
    inv_exp = sum(e['amount'] for e in y_exp if 'invers' in e['category'].lower())
    living_exp = total_exp - inv_exp
    
    total_inc = sum(i['amount'] for i in y_inc)
    
    # Incomes categorization
    salary_keywords = ['acp', 'copa', 'utp', 'aguinaldo', 'licencia', 'beca', 'defensas']
    inv_income_keywords = ['profuturo', 'paullier', 'schwab', 'fortesza', 'interes', 'plazo fijo', 'dividendo', 'quantia', 'meta', 'objetivo']
    rental_keywords = ['alquiler']
    
    salaries = 0.0
    inv_inc = 0.0
    rent_inc = 0.0
    other_inc = 0.0
    
    for inc in y_inc:
        d_lower = inc['desc'].lower()
        amt = inc['amount']
        if any(k in d_lower for k in salary_keywords):
            salaries += amt
        elif any(k in d_lower for k in inv_income_keywords):
            inv_inc += amt
        elif any(k in d_lower for k in rental_keywords):
            rent_inc += amt
        else:
            other_inc += amt
            
    net_living_cashflow = total_inc - living_exp
    net_total_cashflow = total_inc - total_exp
    
    print(f"\n--- AÑO {y} ---")
    print(f"  Ingresos Totales:        ${total_inc:12,.2f}")
    print(f"    - Salarios/Nómina:     ${salaries:12,.2f} ({salaries/total_inc*100 if total_inc else 0:.1f}%)")
    print(f"    - Inversiones (Rend):  ${inv_inc:12,.2f} ({inv_inc/total_inc*100 if total_inc else 0:.1f}%)")
    print(f"    - Alquileres:          ${rent_inc:12,.2f} ({rent_inc/total_inc*100 if total_inc else 0:.1f}%)")
    print(f"    - Otros/Reembolsos:    ${other_inc:12,.2f} ({other_inc/total_inc*100 if total_inc else 0:.1f}%)")
    print(f"  Gastos Totales:          ${total_exp:12,.2f}")
    print(f"    - Gastos de Vida:      ${living_exp:12,.2f}")
    print(f"    - Inversiones (Aporte):${inv_exp:12,.2f}")
    print(f"  Flujo Operativo (OpCF):  ${net_living_cashflow:12,.2f} (Ingresos - Gastos de Vida)")
    print(f"  Flujo Neto Total:        ${net_total_cashflow:12,.2f} (Ingresos - Todos los Gastos)")
