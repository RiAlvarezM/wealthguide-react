import csv

path = '/Users/ricardo/Repos/WealthDashboard/wealthguide-react/local-data/Report (17).csv'

incomes = []

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    r = csv.reader(f)
    sec = None
    for row in r:
        if not row: continue
        if row[0].strip() == 'Fecha' and len(row) > 1 and row[1].strip() == 'Descripción':
            sec = 'inc'
            continue
        if row[0].strip() == 'Categoría' and len(row) > 1 and row[1].strip() == 'SubCategoría':
            sec = 'bud'
            continue
        if sec == 'inc' and len(row) >= 4 and row[0].strip()[:4].isdigit():
            amt = float(row[2].replace(',', '').strip() or 0)
            incomes.append({
                'date': row[0].strip(),
                'desc': row[1].strip(),
                'amount': amt,
                'account': row[3].strip(),
                'notes': row[4].strip() if len(row) > 4 else ''
            })

acp_2026 = [i for i in incomes if i['date'].startswith('2026') and 'acp' in i['desc'].lower()]
copa_2026 = [i for i in incomes if i['date'].startswith('2026') and 'copa' in i['desc'].lower() and 'xiii' not in i['desc'].lower()]

print(f"Total ACP 2026 transactions: {len(acp_2026)}")
for t in acp_2026:
    print(f"  {t['date']} | ${t['amount']:8,.2f} | {t['account']:15s} | {t['notes']}")

print(f"\nTotal Copa 2026 transactions: {len(copa_2026)}")
for t in copa_2026:
    print(f"  {t['date']} | ${t['amount']:8,.2f} | {t['account']:15s} | {t['notes']}")
