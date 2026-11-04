import { useState, useEffect } from 'react';

/**
 * QuickExpenseModal.jsx
 * Modal / Bottom-Sheet de Registro Rápido estilo HomeBudget.
 * Incluye:
 *  - Display numérico grande con calculadora táctil integrada
 *  - Selector de Tipo: Gasto / Ingreso / Transferencia
 *  - Selector de Categorías y Subcategorías
 *  - Selector de Cuenta de origen o destino
 *  - Comercio / Beneficiario y Notas
 *  - Fecha (por defecto hoy)
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
  const [amountStr, setAmountStr] = useState('0');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');

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

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0]);
    }
    if (accounts.length > 1 && !toAccount) {
      setToAccount(accounts[1]);
    }
  }, [accounts, selectedAccount, toAccount]);

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

    const transactionData = {
      id: `manual_${Date.now()}`,
      type,
      date,
      amount: numericAmount,
      account: selectedAccount,
      toAccount: type === 'transfer' ? toAccount : undefined,
      category: type === 'expense' ? selectedCategory : (type === 'income' ? 'Ingreso' : 'Transferencia'),
      subcategory: type === 'expense' ? selectedSubcategory : '',
      payee: payee.trim(),
      notes: notes.trim(),
      device: 'Web App'
    };

    onSave(transactionData);
    setAmountStr('0');
    setNotes('');
    setPayee('');
    onClose();
  };

  if (!isOpen) return null;

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
              Gasto
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
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Transferencia
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
              Monto del {type === 'expense' ? 'Gasto' : type === 'income' ? 'Ingreso' : 'Traslado'}
            </div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-slate-400">$</span>
              <span className={`text-4xl sm:text-5xl font-black tracking-tight ${
                type === 'expense' ? 'text-rose-600 dark:text-rose-400' :
                type === 'income' ? 'text-emerald-600 dark:text-emerald-400' :
                'text-sky-600 dark:text-sky-400'
              }`}>
                {amountStr}
              </span>
            </div>
          </div>

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
                    Categoría
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

            {/* Cuenta de Pago / Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                  {type === 'transfer' ? 'Desde Cuenta' : type === 'income' ? '¿En qué cuenta entra el dinero?' : 'Cuenta / Tarjeta'}
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-zinc-100 outline-none cursor-pointer"
                >
                  {accounts.map((acc) => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </select>
              </div>

              {type === 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                    Hacia Cuenta
                  </label>
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-zinc-100 outline-none cursor-pointer"
                  >
                    {accounts.map((acc) => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
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
              'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20'
            }`}
          >
            <span className="material-symbols-outlined text-base">check</span>
            Guardar {type === 'expense' ? 'Gasto' : type === 'income' ? 'Ingreso' : 'Transferencia'}
          </button>
        </div>

      </div>
    </div>
  );
}
