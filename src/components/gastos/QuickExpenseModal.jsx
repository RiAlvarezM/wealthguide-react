import { useState, useEffect, useMemo } from 'react';
import { groupAccountsByPool, isInvestmentAccount, classifyTransfer } from '../../lib/accountClassification';

/**
 * QuickExpenseModal.jsx
 * Modal / Bottom-Sheet de Registro Rápido estilo HomeBudget.
 * Soporta el Modelo de 2 Bolsas:
 *  - Gasto: Costo de vida real
 *  - Ingreso: Dinero entrante a la bolsa de liquidez
 *  - Transferencia:
 *     * Aporte a Inversión (Mi Ahorro Real: Liquidez -> Inversión)
 *     * Traspaso Interno / Pago de Tarjeta (Liquidez -> Liquidez)
 *     * Retiro de Inversión (Inversión -> Liquidez)
 */

const QUICK_INCOME_SOURCES = [
  'Salario ACP',
  'Salario Copa',
  'Alquiler',
  'Intereses',
  'Reembolso',
  'Dividendos',
  'Consultoría',
  'Otros'
];

export default function QuickExpenseModal({
  isOpen,
  initialType = 'expense',
  onClose,
  onSave,
  categories = [],
  accounts = []
}) {
  const [type, setType] = useState(initialType); // 'expense' | 'income' | 'transfer'
  const [transferPurpose, setTransferPurpose] = useState('aporte_inversion'); // 'aporte_inversion' | 'traspaso_liquidez' | 'retiro_inversion'
  const [amountStr, setAmountStr] = useState('0');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');

  // Agrupación de cuentas en las 2 bolsas
  const groupedAccounts = useMemo(() => {
    return groupAccountsByPool(accounts);
  }, [accounts]);

  // Sync initialType when opened
  useEffect(() => {
    if (isOpen && initialType) {
      setType(initialType);
    }
  }, [isOpen, initialType]);

  // Default first category and account
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].name);
      if (categories[0].subcategories?.length > 0) {
        setSelectedSubcategory(categories[0].subcategories[0]);
      }
    }
  }, [categories, selectedCategory]);

  // Configuración de cuentas según propósito de transferencia
  useEffect(() => {
    if (!accounts || accounts.length === 0) return;

    const liqAccs = groupedAccounts.liquidity;
    const invAccs = groupedAccounts.investment;

    if (type === 'transfer') {
      if (transferPurpose === 'aporte_inversion') {
        // Desde Liquidez hacia Inversión
        if (!selectedAccount || isInvestmentAccount(selectedAccount)) {
          setSelectedAccount(liqAccs[0] || accounts[0]);
        }
        if (!toAccount || !isInvestmentAccount(toAccount)) {
          setToAccount(invAccs[0] || 'Schwab');
        }
      } else if (transferPurpose === 'traspaso_liquidez') {
        // Entre cuentas de liquidez
        if (!selectedAccount || isInvestmentAccount(selectedAccount)) {
          setSelectedAccount(liqAccs[0] || accounts[0]);
        }
        if (!toAccount || isInvestmentAccount(toAccount) || toAccount === selectedAccount) {
          const secondLiq = liqAccs.find(a => a !== selectedAccount) || liqAccs[1] || liqAccs[0];
          setToAccount(secondLiq);
        }
      } else if (transferPurpose === 'retiro_inversion') {
        // Desde Inversión hacia Liquidez
        if (!selectedAccount || !isInvestmentAccount(selectedAccount)) {
          setSelectedAccount(invAccs[0] || 'Schwab');
        }
        if (!toAccount || isInvestmentAccount(toAccount)) {
          setToAccount(liqAccs[0] || accounts[0]);
        }
      }
    } else {
      if (!selectedAccount) {
        setSelectedAccount(liqAccs[0] || accounts[0]);
      }
    }
  }, [type, transferPurpose, accounts, groupedAccounts]);

  const currentCategoryObj = categories.find(c => c.name === selectedCategory);
  const subcategories = currentCategoryObj?.subcategories || [];

  const handleCategorySelect = (catName) => {
    setSelectedCategory(catName);
    const cat = categories.find(c => c.name === catName);
    if (cat?.subcategories?.length > 0) {
      setSelectedSubcategory(cat.subcategories[0]);
    } else {
      setSelectedSubcategory('');
    }
  };

  // Convertir gasto a transferencia de ahorro
  const handleConvertToTransfer = () => {
    setType('transfer');
    setTransferPurpose('aporte_inversion');
    const invAccs = groupedAccounts.investment;
    // Si la subcategoría coincide con una cuenta o destino de inversión, preseleccionarla
    const matched = invAccs.find(acc => acc.toLowerCase() === (selectedSubcategory || '').toLowerCase());
    if (matched) {
      setToAccount(matched);
    }
  };

  // Teclado numérico / Calculadora táctil
  const handleKeypadPress = (key) => {
    if (key === 'C') {
      setAmountStr('0');
      return;
    }
    if (key === '⌫') {
      if (amountStr.length <= 1) {
        setAmountStr('0');
      } else {
        setAmountStr(amountStr.slice(0, -1));
      }
      return;
    }
    if (key === '.') {
      if (!amountStr.includes('.')) {
        setAmountStr(amountStr + '.');
      }
      return;
    }

    if (amountStr === '0') {
      setAmountStr(key);
    } else {
      if (amountStr.includes('.')) {
        const parts = amountStr.split('.');
        if (parts[1].length >= 2) return;
      }
      if (amountStr.length < 10) {
        setAmountStr(amountStr + key);
      }
    }
  };

  const handleSave = () => {
    const numericAmount = parseFloat(amountStr) || 0;
    if (numericAmount <= 0) {
      alert('Por favor ingresa un monto mayor a 0');
      return;
    }

    let transactionData;

    if (type === 'transfer') {
      const transferKind = classifyTransfer(selectedAccount, toAccount);
      transactionData = {
        id: `manual_${Date.now()}`,
        type: 'transfer',
        transferKind, // 'investment_contribution' | 'internal_liquidity' | 'investment_withdrawal'
        date,
        amount: numericAmount,
        account: selectedAccount,
        fromAccount: selectedAccount,
        toAccount,
        category: transferKind === 'investment_contribution' ? 'Aporte Inversión' : 'Transferencia',
        subcategory: toAccount,
        payee: payee.trim() || (transferKind === 'investment_contribution' ? `Aporte a ${toAccount}` : `Traspaso a ${toAccount}`),
        notes: notes.trim(),
        device: 'Web App'
      };
    } else if (type === 'income') {
      transactionData = {
        id: `manual_${Date.now()}`,
        type: 'income',
        date,
        amount: numericAmount,
        account: selectedAccount,
        description: payee.trim() || 'Ingreso',
        payee: payee.trim() || 'Ingreso',
        category: 'Ingreso',
        subcategory: '',
        notes: notes.trim(),
        device: 'Web App'
      };
    } else {
      // Gasto
      transactionData = {
        id: `manual_${Date.now()}`,
        type: 'expense',
        date,
        amount: numericAmount,
        account: selectedAccount,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        payee: payee.trim(),
        notes: notes.trim(),
        device: 'Web App'
      };
    }

    onSave(transactionData);
    setAmountStr('0');
    setNotes('');
    setPayee('');
    onClose();
  };

  if (!isOpen) return null;

  const isInvestmentGastoAlert = type === 'expense' && selectedCategory.toLowerCase() === 'inversion';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header con tipo de transacción */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Costo de Vida (Gasto)
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setType('transfer')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                type === 'transfer'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Transferencia / Ahorro
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          
          {/* Display Grande del Monto */}
          <div className="bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              {type === 'expense' ? 'Monto del Costo de Vida' : type === 'income' ? 'Monto del Ingreso' : 'Monto a Transferir / Ahorrar'}
            </div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-slate-400">$</span>
              <span className={`text-4xl sm:text-5xl font-black tracking-tight ${
                type === 'expense' ? 'text-rose-600 dark:text-rose-400' :
                type === 'income' ? 'text-emerald-600 dark:text-emerald-400' :
                'text-teal-600 dark:text-teal-400'
              }`}>
                {amountStr}
              </span>
            </div>
          </div>

          {/* Sub-propósito de la transferencia si type === 'transfer' */}
          {type === 'transfer' && (
            <div className="bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 p-2.5 rounded-xl space-y-1.5">
              <div className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                ¿Qué tipo de movimiento es?
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTransferPurpose('aporte_inversion')}
                  className={`px-2 py-2 text-[11px] font-bold rounded-lg transition-all text-center leading-tight ${
                    transferPurpose === 'aporte_inversion'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-white'
                  }`}
                >
                  📈 Aporte a Inversión
                  <span className="block text-[9px] font-normal opacity-80">(Mi Ahorro)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferPurpose('traspaso_liquidez')}
                  className={`px-2 py-2 text-[11px] font-bold rounded-lg transition-all text-center leading-tight ${
                    transferPurpose === 'traspaso_liquidez'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-white'
                  }`}
                >
                  💳 Traspaso Interno
                  <span className="block text-[9px] font-normal opacity-80">(Bancos / Tarjetas)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferPurpose('retiro_inversion')}
                  className={`px-2 py-2 text-[11px] font-bold rounded-lg transition-all text-center leading-tight ${
                    transferPurpose === 'retiro_inversion'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-white'
                  }`}
                >
                  🔄 Retiro Inversión
                  <span className="block text-[9px] font-normal opacity-80">(Hacia Banco)</span>
                </button>
              </div>
            </div>
          )}

          {/* Banner asistido si es gasto de inversión */}
          {isInvestmentGastoAlert && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-lg shrink-0 mt-0.5">
                tips_and_updates
              </span>
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1.5 flex-1">
                <p className="font-semibold">¿Este dinero es para hacer crecer tu patrimonio?</p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Si va hacia Schwab, Fortesza, Jubilación o Fondos, regístralo como <strong>Transferencia a Inversión (Ahorro)</strong> para que no infle artificialmente tu costo de vida.
                </p>
                <button
                  type="button"
                  onClick={handleConvertToTransfer}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg transition-all shadow-xs"
                >
                  Convertir a Transferencia de Ahorro
                </button>
              </div>
            </div>
          )}

          {/* Teclado Numérico Táctil */}
          <div className="grid grid-cols-4 gap-2">
            {['7', '8', '9', '⌫', '4', '5', '6', 'C', '1', '2', '3', '.', '0', '00'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className={`py-2.5 rounded-xl text-base font-bold transition-all active:scale-95 ${
                  k === 'C' || k === '⌫'
                    ? 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300'
                    : 'bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 text-slate-900 dark:text-zinc-100 hover:bg-slate-50 shadow-xs'
                } ${k === '0' ? 'col-span-2' : ''}`}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Formulario de Detalles */}
          <div className="space-y-3 pt-2">
            {/* Fecha */}
            <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">calendar_today</span>
                Fecha
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-900 dark:text-zinc-100 outline-none text-right cursor-pointer"
              />
            </div>

            {/* Categoría y Subcategoría (si es gasto) */}
            {type === 'expense' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5">
                    Categoría de Gasto
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                    {categories.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => handleCategorySelect(c.name)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                          selectedCategory === c.name
                            ? 'bg-rose-600 text-white shadow-xs scale-102'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {subcategories.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5">
                      Subcategoría ({selectedCategory})
                    </label>
                    <select
                      value={selectedSubcategory}
                      onChange={(e) => setSelectedSubcategory(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-zinc-100 outline-none cursor-pointer"
                    >
                      {subcategories.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Si es Ingreso: Pills rápidos de Fuente de Ingreso */}
            {type === 'income' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5">
                  Fuente de Ingreso Frecuente
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                  {QUICK_INCOME_SOURCES.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setPayee(src)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                        payee === src
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cuentas Origen y Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                  {type === 'transfer' ? 'Desde Cuenta (Origen)' : type === 'income' ? '¿En qué cuenta entra?' : 'Cuenta / Tarjeta de Pago'}
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-zinc-100 outline-none cursor-pointer"
                >
                  <optgroup label="Bolsa de Liquidez (Bancos, Ahorros, Tarjetas)">
                    {groupedAccounts.liquidity.map((acc) => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Bolsa de Inversión (Brokers, Jubilación, Fondos)">
                    {groupedAccounts.investment.map((acc) => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {type === 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                    Hacia Cuenta (Destino)
                  </label>
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-zinc-100 outline-none cursor-pointer"
                  >
                    <optgroup label="Bolsa de Inversión (Tu Ahorro Real)">
                      {groupedAccounts.investment.map((acc) => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Bolsa de Liquidez (Bancos, Ahorros, Tarjetas)">
                      {groupedAccounts.liquidity.map((acc) => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {type !== 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                    {type === 'expense' ? 'Comercio / Beneficiario' : 'Descripción del Ingreso'}
                  </label>
                  <input
                    type="text"
                    placeholder={type === 'expense' ? 'Ej. Riba Smith, Netflix, Gasolinera...' : 'Ej. Salario quincena, Alquiler depto...'}
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Notas opcionales */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                Notas adicionales (opcional)
              </label>
              <input
                type="text"
                placeholder="Detalle o referencia..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer con Botón Guardar */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={`flex-2 py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 ${
              type === 'expense' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' :
              type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' :
              'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
            }`}
          >
            <span className="material-symbols-outlined text-base">check</span>
            Guardar {type === 'expense' ? 'Costo de Vida' : type === 'income' ? 'Ingreso' : 'Transferencia'}
          </button>
        </div>

      </div>
    </div>
  );
}
