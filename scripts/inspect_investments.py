import csv
from collections import defaultdict

# 1. Inspect all investment incomes
path = '/Users/ricardo/Repos/WealthDashboard/wealthguide-react/local-data/Report (17).csv'

inv_inc_records = []
inv_exp_records = []
all_incomes = []

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
            amt = float(row[3].replace(',', '').strip() or 0)
            if 'invers' in row[1].lower():
                inv_exp_records.append({
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
            all_incomes.append({
                'date': row[0].strip(),
                'desc': row[1].strip(),
                'amount': amt,
                'account': row[3].strip() if len(row) > 3 else '',
                'notes': row[4].strip() if len(row) > 4 else ''
            })

print("=== ALL TRANSACTIONS OF PROFUTURO INCOME ===")
for inc in all_incomes:
    if 'profuturo' in inc['desc'].lower() or 'profuturo' in inc['notes'].lower():
        print(inc)

print("\n=== ALL TRANSACTIONS OF PAULLIER INCOME ===")
for inc in all_incomes:
    if 'paullier' in inc['desc'].lower() or 'paullier' in inc['notes'].lower():
        print(inc)

print("\n=== ALL TRANSACTIONS OF SCHWAB INCOME ===")
for inc in all_incomes:
    if 'schwab' in inc['desc'].lower() or 'schwab' in inc['notes'].lower():
        print(inc)

print("\n=== ALL TRANSACTIONS OF FORTESZA INCOME ===")
for inc in all_incomes:
    if 'fortesza' in inc['desc'].lower() or 'fortesza' in inc['notes'].lower():
        print(inc)

print("\n=== ALL TRANSACTIONS OF DIVIDENDOS / RENDIMIENTOS / INTERESES ===")
intereses_by_account = defaultdict(float)
for inc in all_incomes:
    d = inc['desc'].lower()
    if 'interes' in d or 'dividendo' in d or 'plazo' in d:
        intereses_by_account[inc['account']] += inc['amount']

for acc, amt in sorted(intereses_by_account.items(), key=lambda x: x[1], reverse=True):
    print(f"  {acc:30s}: ${amt:10,.2f}")
