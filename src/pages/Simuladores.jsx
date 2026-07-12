import { useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';

function formatCurrency(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const DEBTS = [
  { id: 1, name: 'Tarjeta de Crédito A', balance: 5200, apr: 19.9 },
  { id: 2, name: 'Préstamo Auto', balance: 14500, apr: 4.5 },
  { id: 3, name: 'Préstamo Estudiantil', balance: 22000, apr: 6.8 },
];

export default function Simuladores() {
  // --- Compound Interest Simulator ---
  const [initial, setInitial] = useState(10000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(20);

  const { futureValue, totalCapital, interestEarned } = useMemo(() => {
    const monthlyRate = rate / 100 / 12;
    const months = years * 12;
    let balance = initial;
    for (let i = 0; i < months; i += 1) {
      balance = balance * (1 + monthlyRate) + monthly;
    }
    const capital = initial + monthly * months;
    return {
      futureValue: balance,
      totalCapital: capital,
      interestEarned: balance - capital,
    };
  }, [initial, monthly, rate, years]);

  // --- Debt Avalanche / Snowball Calculator ---
  const [strategy, setStrategy] = useState('avalanche'); // 'avalanche' | 'snowball'
  const [extraPayment, setExtraPayment] = useState(250);

  const { timeSavedYears, interestSaved } = useMemo(() => {
    // Estimación simplificada solo para fines demostrativos de la UI.
    const totalBalance = DEBTS.reduce((sum, d) => sum + d.balance, 0);
    const weightedApr =
      DEBTS.reduce((sum, d) => sum + d.balance * (d.apr / 100), 0) / totalBalance;
    const baseline = totalBalance * weightedApr * 0.12; // interés aproximado sin pago extra
    const withExtra = Math.max(0, baseline - extraPayment * (strategy === 'avalanche' ? 12.5 : 11.3));
    return {
      timeSavedYears: Math.max(0.1, (extraPayment / 250) * 2.4).toFixed(1),
      interestSaved: Math.max(0, baseline - withExtra),
    };
  }, [extraPayment, strategy]);

  return (
    <AppLayout title="Simuladores" searchPlaceholder="Buscar escenarios...">
      <header className="mb-lg md:hidden">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">Simuladores</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Explorar escenarios financieros</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-lg">
        {/* Compound Interest Simulator */}
        <section className="bg-white rounded-xl border border-outline-variant p-md flex flex-col gap-md shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-label-md text-label-md uppercase text-secondary tracking-widest flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">trending_up</span> Motor de Crecimiento
              </h2>
              <h3 className="font-headline-md text-headline-md text-on-surface mt-1">Interés Compuesto</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md flex-1">
            {/* Controls */}
            <div className="flex flex-col gap-md bg-surface-container-low p-sm rounded-lg border border-outline-variant/50">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">Inversión Inicial</label>
                  <span className="font-label-sm text-label-sm text-on-surface">{formatCurrency(initial)}</span>
                </div>
                <input
                  className="w-full"
                  max={100000}
                  min={0}
                  step={1000}
                  type="range"
                  value={initial}
                  onChange={(e) => setInitial(Number(e.target.value))}
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">Contribución Mensual</label>
                  <span className="font-label-sm text-label-sm text-on-surface">{formatCurrency(monthly)}</span>
                </div>
                <input
                  className="w-full"
                  max={5000}
                  min={0}
                  step={50}
                  type="range"
                  value={monthly}
                  onChange={(e) => setMonthly(Number(e.target.value))}
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">Rendimiento Esperado</label>
                  <span className="font-label-sm text-label-sm text-on-surface">{rate}%</span>
                </div>
                <input
                  className="w-full"
                  max={15}
                  min={1}
                  step={0.5}
                  type="range"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    Horizonte de Tiempo (Años)
                  </label>
                  <span className="font-label-sm text-label-sm text-on-surface">{years}</span>
                </div>
                <input
                  className="w-full"
                  max={40}
                  min={1}
                  step={1}
                  type="range"
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Result Display */}
            <div className="flex flex-col justify-center items-center bg-tertiary-container rounded-lg p-md text-center relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-secondary-container/20 rounded-full blur-2xl" />
              <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-on-tertiary-container/20 rounded-full blur-2xl" />
              <span className="font-label-sm text-label-sm text-tertiary-fixed-dim uppercase tracking-widest z-10">
                Valor Futuro
              </span>
              <div className="font-display-lg text-display-lg text-white my-sm z-10">
                {formatCurrency(futureValue)}
              </div>
              <div className="w-full flex justify-between mt-sm border-t border-white/10 pt-sm z-10">
                <div className="text-left">
                  <div className="font-label-sm text-label-sm text-tertiary-fixed-dim">Capital Total</div>
                  <div className="font-body-md text-body-md text-white">{formatCurrency(totalCapital)}</div>
                </div>
                <div className="text-right">
                  <div className="font-label-sm text-label-sm text-secondary-fixed">Intereses Ganados</div>
                  <div className="font-body-md text-body-md text-white">{formatCurrency(interestEarned)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Debt Avalanche Calculator */}
        <section className="bg-white rounded-xl border border-outline-variant p-md flex flex-col gap-md shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.05)]">
          <div>
            <h2 className="font-label-md text-label-md uppercase text-on-surface-variant tracking-widest flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">moving</span> Reducción de Pasivos
            </h2>
            <h3 className="font-headline-md text-headline-md text-on-surface mt-1">Avalancha de Deuda</h3>
          </div>

          <div className="flex flex-col gap-md">
            <div className="flex gap-sm p-1 bg-surface-container-low rounded">
              <button
                type="button"
                onClick={() => setStrategy('avalanche')}
                className={`flex-1 py-1.5 rounded text-center font-label-md text-label-md transition-colors ${
                  strategy === 'avalanche'
                    ? 'bg-white shadow-sm border border-outline-variant/30 text-on-surface'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Avalancha (TAE más alta)
              </button>
              <button
                type="button"
                onClick={() => setStrategy('snowball')}
                className={`flex-1 py-1.5 rounded text-center font-label-md text-label-md transition-colors ${
                  strategy === 'snowball'
                    ? 'bg-white shadow-sm border border-outline-variant/30 text-on-surface'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Bola de Nieve (Saldo menor)
              </button>
            </div>

            <div className="border border-outline-variant rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-bright border-b border-outline-variant">
                  <tr>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant uppercase">
                      Nombre de la Deuda
                    </th>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant uppercase text-right">
                      Saldo
                    </th>
                    <th className="p-3 font-label-sm text-label-sm text-on-surface-variant uppercase text-right">
                      TAE
                    </th>
                  </tr>
                </thead>
                <tbody className="font-body-sm text-body-sm">
                  {[...DEBTS]
                    .sort((a, b) =>
                      strategy === 'avalanche' ? b.apr - a.apr : a.balance - b.balance
                    )
                    .map((debt) => (
                      <tr key={debt.id} className="border-b border-outline-variant/50 last:border-b-0 hover:bg-surface-bright/50">
                        <td className="p-3">{debt.name}</td>
                        <td className="p-3 text-right">{formatCurrency(debt.balance)}</td>
                        <td className={`p-3 text-right font-medium ${debt.apr > 10 ? 'text-error' : ''}`}>
                          {debt.apr}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-sm items-center">
              <div className="relative">
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                  Pago Extra Mensual
                </label>
                <span className="absolute left-3 bottom-2.5 text-on-surface-variant font-body-md">$</span>
                <input
                  className="w-full pl-8 pr-3 py-2 border border-outline-variant rounded focus:border-tertiary-container focus:ring-0 font-body-md text-on-surface"
                  type="number"
                  min={0}
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(Number(e.target.value))}
                />
              </div>
              <div className="bg-surface-container-low p-sm rounded border border-outline-variant/50 flex justify-between items-center h-full">
                <div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant">Tiempo Ahorrado</div>
                  <div className="font-headline-md text-headline-md text-secondary">{timeSavedYears} Años</div>
                </div>
                <div className="text-right">
                  <div className="font-label-sm text-label-sm text-on-surface-variant">Intereses Ahorrados</div>
                  <div className="font-headline-md text-headline-md text-on-surface">
                    {formatCurrency(interestSaved)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
