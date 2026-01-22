export const es = {
  // Menú principal
  mainMenu: {
    welcome: "👋 ¡Bienvenido al Bot Financiero!",
    welcomeIntro: "📊 Gestiona tu dinero fácilmente:\n" +
      "• 💸 Registra gastos e ingresos\n" +
      "• 💰 Gestiona múltiples cuentas\n" +
      "• 📉 Rastrea deudas\n" +
      "• 🎯 Establece objetivos financieros\n" +
      "• 📈 Ve estadísticas\n\n" +
      "¿Listo para tomar control de tus finanzas?",
    welcomeBack: "👋 ¡Bienvenido de nuevo! Elige una opción:",
    startTracking: "💰 Comenzar seguimiento",
    quickStartTitle: "🎉 *¡Excelente! ¡Empecemos!*",
    quickStartGuide: "📄 *Inicio rápido:*\n" +
      "1️⃣ Añade tu primera cuenta en 💰 *Saldos*\n" +
      "2️⃣ Registra transacciones vía 💸 *Gasto* y 💰 *Ingreso*\n" +
      "3️⃣ Ve estadísticas en 📈 *Estadísticas*\n\n" +
      "¡Puedes empezar añadiendo un saldo!",
    expense: "💸 Gasto",
    income: "💰 Ingreso",
    balances: "💳 Saldos",
    budgetPlanner: "🔮 Planificador de presupuesto",
    debts: "📉 Deudas",
    goals: "🎯 Objetivos",
    analytics: "📊 Analítica",
    settings: "⚙️ Ajustes",
    mainMenuButton: "🏠 Menú principal",
  },

  // Botones (NUEVA SECCIÓN)
  buttons: {
    // Navegación principal
    mainMenu: "🏠 Menú principal",
    back: "⬅️ Atrás",
    advanced: "⚙️ Avanzado",
    
    // Acciones
    manage: "⚙️ Gestionar",
    saveAsTemplate: "💾 ¿Guardar como plantilla?",
    changeAccount: "🔄 Cambiar cuenta",
    changeAmount: "💫 Cambiar cantidad",
    editAmount: "✏️ Editar cantidad",
    editTarget: "✏️ Editar objetivo",
    editCategory: "📝 Editar categoría",
    editAccount: "💳 Editar cuenta",
    editName: "✏️ Editar nombre",
    tryAgain: "🔄 Intentar de nuevo",
    tryAgainEdit: "✏️ Intentar de nuevo",
    
    // Períodos de tiempo
    weekly: "📆 Semanal",
    monthly: "📅 Mensual",
    last7Days: "📅 Últimos 7 días",
    last30Days: "📅 Últimos 30 días",
    customPeriod: "📅 Período personalizado",
    
    // Categorías
    food: "🍔 Comida",
    transport: "🚗 Transporte",
    shopping: "🛍️ Compras",
    entertainment: "🎮 Entretenimiento",
    bills: "💡 Facturas",
    health: "🏥 Salud",
    salary: "💼 Salario",
    other: "📦 Otro",
    
    // Tipos de transacciones
    expensesOnly: "💸 Solo gastos",
    incomeOnly: "💰 Solo ingresos",
    allTransactions: "🔍 Todas las transacciones",
    
    // Vistas
    filters: "🔎 Filtros",
    trends: "📈 Tendencias",
    topCategories: "📉 Top categorías",
    exportCsv: "📅 Exportar CSV",
    
    // Funciones principales
    balances: "💳 Saldos",
    goToBalances: "💳 Ir a Saldos",
    reviewTransactions: "🔍 Revisar transacciones",
    startTracking: "💰 Comenzar seguimiento",
    
    // Añadir
    addBalance: "✨ Añadir saldo",
    addDebt: "✨ Añadir deuda",
    addGoal: "✨ Añadir objetivo",
    addIncomeSource: "✨ Añadir fuente de ingreso",
    addEditBudget: "✨ Añadir / Editar presupuesto",
    addRecurring: "✨ Añadir recurrente",
    
    // Secciones
    assets: "💳 Activos",
    debts: "💰 Deudas",
    fullReport: "📋 Informe completo",
    summary: "📊 Resumen",
    notifications: "🔔 Notificaciones",
    recurringPayments: "🔁 Pagos recurrentes",
    customMessages: "📝 Mensajes personalizados",
    uploadStatement: "📥 Subir extracto",
    clearAllData: "🗑️ Borrar todos los datos",
    reports: "📈 Informes",
    history: "📋 Historial",
    netWorth: "💎 Patrimonio neto",
    showReport: "📊 Mostrar informe",
    
    // Ajustes
    disableReminders: "🔕 Desactivar recordatorios",
    changeTimezone: "🌍 Cambiar zona horaria",
    
    // Plazos y fechas
    changeDeadline: "📅 Cambiar fecha límite",
    setDeadline: "📅 Establecer fecha límite",
    removeDate: "🗑 Eliminar fecha",
    snooze1Day: "📅 Posponer 1 día",
    
    // Otras acciones
    transferToAnotherAccount: "🔄 Transferir a otra cuenta",
    getPaidFrom: "💰 Recibir pago de",
    more: "📋 Más...",
    viewMore: "🔍 Ver más",
    previousPage: "🔙 Página anterior",
    clearLimit: "🧹 Borrar límite",
    emptyBalance: "⚪ Vaciar saldo",
    
    // Tipos de deudas
    iOwe: "🔴 Yo debo",
    theyOweMe: "🟢 Me deben",
    
    // Moneda
    convertTo: "🔄 Convertir a",
    changeTo: "💱 Cambiar a",
  },

  // Transacciones
  transactions: {
    expenseTitle: "💸 *Gasto*",
    incomeTitle: "💰 *Ingreso*",
    transferTitle: "↔️ *Transferencia*",
    selectAmount: "Elige una cantidad o introduce la tuya:",
    currency: "Moneda:",
    enterAmount: "Introduce la cantidad (ej. 100 o 100 {currency}):",
    enterAmountShort: "Introduce la cantidad:",
    selectCategory: "Elige una categoría:",
    selectAccount: "Elige una cuenta:",
    selectDate: "¿Cuándo fue esta transacción?",
    enterDescription: "Introduce una descripción (opcional):",
    confirmExpense: "💸 *Confirmar gasto*",
    confirmIncome: "💰 *Confirmar ingreso*",
    amount: "Cantidad",
    category: "Categoría",
    date: "Fecha",
    description: "Descripción",
    account: "Cuenta",
    balance: "Saldo",
    saved: "✅ ¡Transacción guardada!",
    addAnotherExpense: "✨ Añadir otro gasto",
    addAnotherIncome: "✨ Añadir otro ingreso",
    noBalances: "⚠️ *No se encontraron saldos*\n\n" +
      "Necesitas al menos una cuenta antes de añadir transacciones.\n\n" +
      "💡 *Inicio rápido:*\n" +
      "1️⃣ Ve a 💰 *Saldos*\n" +
      "2️⃣ Pulsa ✨ *Añadir saldo*\n" +
      "3️⃣ Introduce el nombre de la cuenta y la cantidad",
    goToBalances: "💳 Ir a Saldos",
    topAmounts: "Cantidades rápidas:",
    noTransactions: "Aún no hay transacciones.",
    historyTitle: "📊 *Historial de transacciones*",
    historyFilters: "🔍 Filtros",
    noCategory: "Sin categoría",
    showing: "_Mostrando {count} de {total} transacciones_",
    last7Days: "📅 Últimos 7 días",
    last30Days: "📅 Últimos 30 días",
    expensesOnly: "💸 Solo gastos",
    incomeOnly: "💰 Solo ingresos",
    customPeriod: "📅 Período personalizado",
    allTransactions: "🔍 Todas las transacciones",
    exportCSV: "📅 Exportar CSV",
    trends: "📈 Tendencias",
    topCategories: "📉 Top categorías",
    invalidCategory: "❌ Categoría inválida. Elige de la lista.",
    selectDeductAccount: "💸 Elige cuenta para descontar:",
    selectAddAccount: "💰 Elige cuenta para añadir:",
    yesRefund: "✅ Sí, es un reembolso",
    noPositiveBalance: "❌ No hay cuentas con saldo positivo para transferir.",
    cannotTransferSame: "❌ No se puede transferir a la misma cuenta. Elige otra.",
  },

  // Saldos
  balances: {
    title: "💳 *Saldos*",
    addBalance: "✨ Añadir saldo",
    addTitle: "💳 *Añadir cuenta*",
    transfer: "↔️ Transferencia",
    noBalances: "💡 Aún no hay saldos. ¡Añade tu primera cuenta!",
    noAccounts: "No hay cuentas. Añade una.",
    listTitle: "💳 *Cuentas*",
    totalNet: "Patrimonio neto total",
    enterName: "Introduce el nombre de la cuenta (ej. Tarjeta principal, Efectivo, Ahorros):",
    enterAmount: "Introduce el saldo actual:",
    selectCurrency: "Elige moneda:",
    amount: "Cantidad:",
    select: "Elige un saldo para editar:",
    created: "✅ ¡Cuenta creada!",
    updated: "✅ ¡Saldo actualizado!",
    deleted: "✅ ¡Saldo eliminado!",
    deleteConfirm: "¿Estás seguro de que quieres eliminar la cuenta \"{name}\"?",
    cannotUndo: "Esta acción no se puede deshacer.",
    yesDelete: "✅ Sí, eliminar",
    transferFrom: "Transferir desde cuenta:",
    transferTo: "Transferir a cuenta:",
    transferAmount: "Introduce la cantidad a transferir:",
    transferComplete: "✅ ¡Transferencia completada!",
    editNameTitle: "💳 *Editar nombre de cuenta*",
    current: "Actual:",
    enterNew: "Introduce el nuevo nombre:",
    editAmountTitle: "💳 *Editar cantidad en cuenta*",
    enterNewAmount: "Introduce la nueva cantidad:",
    transferToAnother: "🔄 Transferir a otra cuenta",
    yesSetZero: "✅ Sí, poner a cero",
    invalidInput: "❌ Entrada inválida.\n\n• Introduce un *número* para cambiar la cantidad (ej. 500)\n• Introduce *texto* para renombrar (ej. MiTarjeta)",
    selectFromButtons: "❌ Elige un saldo de los botones.",
    invalidInputEdit: "❌ Entrada inválida.",
    balancesButton: "💳 Saldos",
  },

  // Deudas
  debts: {
    title: "📉 *Deudas*",
    addDebt: "✨ Añadir deuda",
    iOwe: "🔴 Yo debo",
    theyOweMe: "🟢 Me deben",
    youOwe: "💸 *TÚ DEBES:*",
    theyOwe: "💰 *TE DEBEN:*",
    totalIOwe: "Total que debo",
    totalTheyOwe: "Total que me deben",
    noDebts: "✅ ¡No hay deudas activas!",
    noDebtsRecorded: "No hay deudas registradas.",
    listTitle: "📝 *Deudas*",
    netDebt: "📊 Total:",
    youOweNet: "tú debes",
    theyOweNet: "te deben",
    enterName: "Introduce el nombre del deudor/acreedor:",
    enterAmount: "Introduce la cantidad de la deuda:",
    selectType: "Elige el tipo de deuda:",
    selectDebt: "Elige una deuda para editar:",
    statusPending: "⏳",
    statusPaid: "✅",
    labelIOwe: "🔴 Yo debo",
    labelTheyOwe: "🟢 Me deben",
    due: "Vencimiento:",
    created: "✅ ¡Deuda registrada!",
    paymentRecorded: "✅ ¡Pago registrado!",
    markAsPaid: "✅ Marcar como pagado",
    recordPayment: "💵 Registrar pago",
    deleteConfirm: "¿Estás seguro de que quieres eliminar la deuda \"{name}\"?",
    editNameTitle: "📝 *Editar nombre de deuda*",
    enterNewName: "Introduce el nuevo nombre:",
    editAmountTitle: "💰 *Editar cantidad de deuda*",
    enterNewAmount: "Introduce la nueva cantidad:",
    setDeadline: "📅 Establecer fecha límite",
    changeDeadline: "📅 Cambiar fecha límite",
    enterDeadline: "Introduce la nueva fecha límite (DD.MM.AAAA):",
    deadlineExample: "Ejemplo: 31.12.2026",
    removePrompt: "O pulsa 🗑 Eliminar para quitar la fecha límite.",
    skipPrompt: "O pulsa ⏩ Omitir para cancelar.",
    markPaidTitle: "✅ ¿Marcar deuda como pagada?",
    debtName: "Deuda:",
    actionWill: "Esta acción:",
    willMarkPaid: "• Marcará la deuda como PAGADA",
    willRemove: "• La quitará de las deudas activas",
    yesMarkPaid: "✅ Sí, marcar como pagada",
    setDueDate: "📅 Establecer fecha de vencimiento",
    changeDueDate: "📅 Cambiar fecha de vencimiento",
    setDueDateTitle: "📅 *Establecer fecha de vencimiento*",
    changeDueDateTitle: "📅 *Cambiar fecha de vencimiento*",
    enterDueDate: "Introduce la nueva fecha de vencimiento (DD.MM.AAAA):",
    dueDateExample: "Ejemplo: 31.12.2026",
    removeDueDatePrompt: "O pulsa 🗑 Eliminar fecha para quitar la fecha de vencimiento.",
    disableReminders: "🔕 Desactivar recordatorios",
    remindersDisabled: "✅ Recordatorios desactivados y fecha de vencimiento eliminada.",
    enableAutoPayment: "✅ Activar pago automático",
    disableAutoPayment: "❌ Desactivar pago automático",
    autoPaymentComingSoon: "⚠️ ¡La función de pagos automáticos llegará pronto!",
    payTo: "💸 Pagar a",
    getPaidFrom: "💰 Recibir pago de",
    selectPayAccount: "💳 Elige cuenta para pagar:",
    selectReceiveAccount: "💰 Elige cuenta para recibir:",
    fullyPaidClosed: "🎉 ¡Deuda completamente pagada y cerrada!",
    fullyReceivedClosed: "🎉 ¡Deuda completamente recibida y cerrada!",
    notFound: "❌ Deuda no encontrada.",
    typeNotFound: "❌ Tipo de deuda no encontrado.",
    noBalancesForPayment: "⚠️ *No se encontraron saldos*\n\nNecesitas al menos una cuenta antes de hacer pagos.",
    quickStartTitle: "💡 *Inicio rápido:*",
    quickStartStep1: "1️⃣ Ve a 💰 *Saldos*",
    quickStartStep2: "2️⃣ Pulsa ✨ *Añadir saldo*",
    quickStartStep3: "3️⃣ Introduce el nombre de la cuenta y la cantidad",
    changeAmount: "💫 Cambiar cantidad",
  },

  // Objetivos
  goals: {
    title: "🎯 *Objetivos*",
    addGoal: "✨ Añadir objetivo",
    addTitle: "🎯 *Añadir objetivo*",
    noGoals: "💡 Aún no hay objetivos. ¡Crea tu primer objetivo!",
    noGoalsYet: "Aún no hay objetivos.",
    listTitle: "🎯 *Objetivos*",
    progress: "Progreso",
    target: "Objetivo:",
    current: "Actual:",
    remaining: "Restante",
    completed: "✅ Objetivos completados",
    completedTitle: "✅ *Objetivos completados*",
    noCompleted: "💭 Aún no hay objetivos completados.",
    achieved: "Logrado:",
    selectCompleted: "✅ Objetivo: {name}",
    enterName: "Introduce el nombre del objetivo (ej. Vacaciones, Teléfono nuevo):",
    enterTarget: "Introduce la cantidad objetivo:",
    enterCurrent: "Introduce la cantidad actual (opcional):",
    enterFormat: "Introduce el objetivo en formato:",
    formatExample: "`NombreObjetivo cantidad MONEDA`",
    examples: "*Ejemplos:*",
    example1: "• `Portátil 2000 {currency}`",
    example2: "• `Vacaciones 5000 USD`",
    example3: "• `Fondo de emergencia 10000` (usa {currency})",
    created: "✅ ¡Objetivo creado!",
    updated: "✅ ¡Objetivo actualizado!",
    deleted: "✅ ¡Objetivo eliminado!",
    addProgress: "📈 Añadir progreso",
    completeGoal: "✅ Completar objetivo",
    statusInProgress: "⏳",
    statusCompleted: "✅",
    selectGoal: "Elige un objetivo para editar:",
    deleteConfirm: "¿Estás seguro de que quieres eliminar el objetivo \"{name}\"?",
    editNameTitle: "🎯 *Editar nombre de objetivo*",
    enterNewName: "Introduce el nuevo nombre:",
    editTargetTitle: "🎯 *Editar cantidad objetivo*",
    enterNewTarget: "Introduce la nueva cantidad objetivo:",
    depositTitle: "💰 *Depositar en objetivo*",
    goalName: "Objetivo:",
    progressDetailed: "Progreso: {current} / {target} {currency} ({percent}%)",
    enterDeposit: "Introduce la cantidad a depositar:",
    markCompletedTitle: "🎉 ¿Marcar objetivo como completado?",
    willMarkCompleted: "• Marcará el objetivo como COMPLETADO",
    willMove: "• Lo moverá a objetivos completados",
    yesMarkCompleted: "✅ Sí, marcar como completado",
    setDeadlineBtn: "📅 Establecer fecha límite",
    changeDeadlineBtn: "📅 Cambiar fecha límite",
    setDeadlineTitle: "📅 *Establecer fecha límite*",
    changeDeadlineTitle: "📅 *Cambiar fecha límite*",
    enterDeadline: "Introduce la nueva fecha límite (DD.MM.AAAA):",
    deadlineExample: "Ejemplo: 31.12.2026",
    removeDeadlinePrompt: "O pulsa 🗑 Eliminar fecha para quitar la fecha límite.",
    disableReminders: "🔕 Desactivar recordatorios",
    remindersDisabled: "✅ Recordatorios desactivados y fecha límite eliminada.",
    enableAutoDeposit: "✅ Activar depósito automático",
    disableAutoDeposit: "❌ Desactivar depósito automático",
    completedGoalsTitle: "✅ *Objetivos completados*",
    noCompletedGoals: "💭 Aún no hay objetivos completados.",
    errorMissingData: "❌ Error: Faltan datos del objetivo",
    noBalancesForDeposit: "⚠️ *No se encontraron saldos*\n\nNecesitas al menos una cuenta antes de depositar en objetivos.",
    quickStartTitle: "💡 *Inicio rápido:*",
    quickStartStep1: "1️⃣ Ve a 💰 *Saldos*",
    quickStartStep2: "2️⃣ Pulsa ✨ *Añadir saldo*",
    quickStartStep3: "3️⃣ Introduce el nombre de la cuenta y la cantidad",
    changeAmount: "💫 Cambiar cantidad",
    advancedSettings: "⚙️ Avanzado",
    editTarget: "✏️ Editar objetivo",
    deleteGoal: "🗑 Eliminar objetivo",
  },

  // Ajustes
  settings: {
    title: "⚙️ *Ajustes*",
    manageConfig: "Gestionar configuración del bot:",
    language: "🌍 Idioma",
    currency: "💵 Moneda",
    changeCurrency: "🌐 Cambiar moneda",
    changeCurrencyTitle: "💱 *Cambiar moneda*",
    selectNewCurrency: "Elige la nueva moneda predeterminada:",
    notifications: "🔔 Notificaciones",
    recurring: "🔁 Pagos recurrentes",
    incomeSources: "💵 Fuentes de ingreso",
    automation: "🤖 Automatización",
    advanced: "🛠️ Avanzado",
    help: "❓ Ayuda e info",
    helpInfo: "❓ Ayuda e info",
    clearData: "🗑️ Borrar todos los datos",
    selectLanguage: "Elige idioma:",
    currentLanguage: "Idioma actual:",
    languageChanged: "✅ ¡Idioma cambiado a {language}!",
    selectCurrency: "Elige moneda predeterminada:",
    currentCurrency: "Moneda actual:",
    currencyChanged: "✅ ¡Moneda cambiada a {currency}!",
    enabled: "✅ Activado",
    disabled: "❌ Desactivado",
    yesDeleteEverything: "✅ Sí, eliminar todo",
    yesChange: "✅ Sí, cambiar",
    currencySet: "✅ Moneda predeterminada establecida: {currency}",
    balancesConverted: "🔄 {count} saldo(s) convertido(s) a {currency}",
  },

  // Analítica
  analytics: {
    title: "📊 *Analítica*",
    exportCSV: "📅 Exportar CSV",
    filters: "🔎 Filtros",
    trends: "📈 Tendencias",
    topCategories: "📉 Top categorías",
    reports: "📈 Informes",
    history: "📋 Historial",
    netWorth: "💎 Patrimonio neto",
  },

  // Presupuesto
  budget: {
    title: "🔮 *Planificador de presupuesto*",
    addBudget: "✨ Añadir presupuesto",
    noBudgets: "💡 Aún no hay presupuestos. ¡Crea el primero!",
    monthly: "Mensual",
    weekly: "Semanal",
    category: "Categoría",
    limit: "Límite",
    spent: "Gastado",
    remaining: "Restante",
  },

  // Común (ACTUALIZADO)
  common: {
    back: "⬅️ Atrás",
    cancel: "❌ Cancelar",
    confirm: "✅ Confirmar",
    edit: "✏️ Editar",
    delete: "🗑️ Eliminar",
    save: "💾 Guardar",
    skip: "⏩ Omitir",
    done: "✅ Hecho",
    yes: "✅ Sí",
    no: "❌ No",
    today: "📆 Hoy",
    yesterday: "🗓️ Ayer",
    custom: "📅 Fecha personalizada",
    selectDate: "Elige una fecha:",
    enterDate: "Introduce la fecha (DD.MM.AAAA):",
    or: "o",
    amount: "Cantidad:",
    continue: "¿Continuar?",
    remove: "🗑 Eliminar",
    total: "Total:",
    removeDate: "🗑 Eliminar fecha",
    previous: "◀️ Anterior",
    next: "Siguiente ▶️",
    noCancel: "❌ No, cancelar",
    cancelled: "✅ Cancelado.",
    
    // Acciones de edición
    editAmount: "💰 Editar cantidad",
    editAccount: "💳 Editar cuenta",
    editCategory: "✏️ Editar categoría",
    editDescription: "✏️ Editar descripción",
    
    // Navegación y acciones generales
    goToBalances: "💳 Ir a Saldos",
    importAll: "✅ Importar todo",
    editAndImport: "✏️ Editar e importar",
    keepAndNext: "✅ Mantener y siguiente",
    yesSave: "✅ Sí, guardar",
    yesDelete: "✅ Sí, eliminar",
    yesSetToZero: "✅ Sí, poner a cero",
    
    // Estado
    enabled: "✅ Activado",
    disabled: "❌ Desactivado",
    
    // Mensajes
    error: "❌ Error",
    notFound: "❌ No encontrado",
    selectAccount: "💳 Elige una cuenta:",
    enterDay: "📅 *Introduce el día del mes (1-31):*",

    // NUEVO: Mensajes del bot
    botWasBlocked: "🚫 El bot fue bloqueado por el usuario o el chat no se encontró.",
    fetchedFreshRates: "🌐 Tipos de cambio actualizados desde la API",
    actionCannotBeUndone: "❗ ¡Esta acción NO se puede deshacer!\n\n",
    
    // NUEVO: Mensajes personalizados
    enterCustomDebtReminder: "📝 *Introduce plantilla personalizada de recordatorio de deuda:*\n\n",
    enterCustomGoalReminder: "📝 *Introduce plantilla personalizada de recordatorio de objetivo:*\n\n",
    enterCustomIncomeReminder: "📝 *Introduce plantilla personalizada de recordatorio de ingreso:*\n\n",
    
    // NUEVO: Entrada del usuario
    userCanTextInput: "💡 O el usuario puede usar entrada de texto: ",
    trackMoneyWithEase: "📊 Rastrea tu dinero fácilmente:\n",
    
    // NUEVO: Títulos
    transactionHistorySelectFilter: "📋 *Historial de transacciones*\n\nElige filtro:",
    transactionHistorySelectPeriod: "📋 *Historial de transacciones*\n\nElige período:",
    personalFinanceBotGuide: "❓ *Bot de Finanzas Personales - Guía de usuario*\n\n",
    uploadBankStatement: "📥 *Subir extracto bancario*\n\n",
    welcomeTitle: "👋 *¡Bienvenido al Bot de Finanzas Personales!*\n\n",
    analyticsViewInsights: "📊 *Analítica*\n\nVe tus perspectivas financieras:",
    analyticsSelectWhatToSee: "📊 *Analítica*\n\nElige qué quieres ver:",
    automationManage: "🤖 *Automatización*\n\nGestiona funciones automatizadas:",
    queryPerformanceReport: "🔍 *Informe de rendimiento de consultas*\n\n",
    incomePlanVsActual: "💵 *Plan de ingresos vs Real*\n\nEsperado:\n",
    financialGoals: "🎯 *Tus objetivos financieros*\n\n",
    budgetSetup: "💳 *Configuración de presupuesto*\n\n",
    activeReminders: "📝 *Recordatorios activos*\n\n",
    noActiveReminders: "💭 No hay recordatorios activos\n\n",
    debtsTitle: "💸 *Deudas:*\n",
    goalsTitle: "🎯 *Objetivos:*\n",
    incomeSourcesTitle: "💵 *Fuentes de ingreso:*\n",
    reportsFiltersSelectPeriod: "📊 *Filtros de informes*\n\nElige período:",
    budgetPlannerSelectCategory: "🔮 *Planificador de presupuesto*\n\nElige categoría para establecer límite:",
    editTransactionsSelect: "✏️ *Editar transacciones*\n\nElige otra transacción para editar:",
    addIncomeSourceTitle: "💼 *Añadir fuente de ingreso*\n\n",
    enterIncomeSourceName: "💼 Introduce el nombre de la fuente de ingreso:\n\nEjemplo: Salario, Freelance",
    
    // NUEVO: Elegir cuenta
    selectAccountAdd: "💰 Elige cuenta para añadir:",
    selectSourceAccount: "📤 Elige cuenta de origen:",
    selectDestinationAccount: "📥 Elige cuenta de destino:",
    selectAccountPayment: "💳 Elige cuenta para pagar:",
    selectAccountWithdraw: "💳 Elige cuenta para retirar:",
    selectAccountReceiveRefund: "📥 Elige cuenta para recibir reembolso:",
    selectAccountDeposit: "💳 Elige cuenta para depositar:",
    selectAccountDepositRemaining: "💳 Elige cuenta para depositar cantidad restante:",
    
    // NUEVO: Editar categoría
    editCategoryExpense: "📝 *Editar categoría (Gasto)*\n\nActual: ",
    editCategoryIncome: "📝 *Editar categoría (Ingreso)*\n\nActual: ",
    
    // NUEVO: Mensajes de estado
    noTransactionsThisMonth: "📊 No hay transacciones este mes.",
    topExpensesNone: "📉 *Top gastos*\n\nNo hay gastos este mes.",
    noTransactionsYet: "📭 Aún no se encontraron transacciones.",
    noMoreTransactions: "📭 No hay más transacciones",
    noTransactionsMatchFilter: "📬 No hay transacciones que coincidan con este filtro.",
    noMoreTransactionsToEdit: "💭 No hay más transacciones para editar.",
    noIncomeOrExpenseThisMonth: "📊 No hay transacciones de ingreso o gasto este mes (solo transferencias).",
    debtFullyReceived: "💰 ¡Deuda completamente recibida!",
    
    // NUEVO: Procesamiento
    uploadingAudioAssemblyAI: "🎤 Subiendo audio a AssemblyAI...",
    creatingTranscriptionJob: "🎤 Creando trabajo de transcripción...",
    waitingForTranscription: "🎤 Esperando transcripción...",
    checkingRecurringTransactions: "🔄 Comprobando transacciones recurrentes...",
    checkingAutoDeposits: "💰 Comprobando depósitos automáticos...",
    checkingAutoIncomes: "💼 Comprobando ingresos automáticos...",
    checkingAutoDebtPayments: "💸 Comprobando pagos automáticos de deudas...",
  },

  // Errores (NUEVA SECCIÓN)
  errors: {
    // Acceso y permisos
    accessDenied: "❌ Acceso denegado",
    
    // No encontrado
    debtNotFound: "❌ Deuda no encontrada.",
    goalNotFound: "❌ Objetivo no encontrado.",
    incomeSourceNotFound: "❌ Fuente de ingreso no encontrada.",
    templateNotFound: "❌ Plantilla no encontrada.",
    goalDataNotFound: "❌ Datos del objetivo no encontrados.",
    
    // Entrada inválida
    invalidData: "❌ Datos inválidos. Por favor verifica tu entrada.",
    invalidInput: "❌ Entrada inválida.\n\n",
    invalidAccountFormat: "❌ Formato de cuenta inválido. Por favor elige de la lista.",
    invalidAccountName: "❌ Nombre de cuenta inválido.",
    invalidDateFormat: "❌ Formato de fecha inválido. Usa DD.MM.AAAA (ej. 31.12.2026)",
    invalidTimezone: "❌ Zona horaria inválida. Por favor elige de las opciones.",
    invalidCategory: "❌ Categoría inválida. Por favor elige de la lista.",
    invalidDay: "❌ Día inválido. Por favor elige de la lista.",
    invalidAmount: "❌ Cantidad inválida. Por favor introduce un número válido.",
    invalidPeriod: "❌ Período inválido (fin antes del inicio o fechas incorrectas).",
    
    // Formato incorrecto
    wrongDates: "❌ ¡Fechas incorrectas!",
    wrongFormatStart: "❌ ¡Formato incorrecto! Usa DD.MM.AAAA (ej. 01.01.2026)",
    wrongFormatEnd: "❌ ¡Formato incorrecto! Usa DD.MM.AAAA (ej. 13.01.2026)",
    endDateBeforeStart: "❌ ¡Fecha de fin antes del inicio!",
    
    // Datos faltantes
    accountNameMissing: "❌ Falta el nombre de la cuenta. Comienza de nuevo.",
    accountNameCannot: "❌ El nombre de la cuenta no puede",
    categoryMissing: "❌ Falta la categoría.",
    templateMissing: "❌ Falta el ID de plantilla.",
    missingDebtData: "❌ Error: Faltan datos de la deuda",
    nameCannotBeEmpty: "❌ El nombre no puede estar vacío.",
    incomeSourceNotSelected: "❌ No se seleccionó fuente de ingreso.",
    
    // Errores de selección
    selectBalanceFromButtons: "❌ Elige un saldo de los botones.",
    selectTransactionFromList: "❌ Elige una transacción de la lista.",
    selectDebtFromList: "❌ Elige una deuda de la lista.",
    selectGoalFromList: "❌ Elige un objetivo de la lista.",
    selectCategoryFromList: "❌ Elige una categoría de la lista.",
    selectCategoryOrAddBudget: "❌ Elige una categoría de la lista o usa ✨ Añadir / Editar presupuesto.",
    selectIncomeSourceOrAdd: "❌ Elige una fuente de ingreso de la lista o usa ✨ Añadir fuente de ingreso.",
    selectOneFilter: "❌ Elige uno de los filtros.",
    pleaseSelectOption: "❌ Por favor elige una opción de los botones.",
    pleaseSelectOptionOrAmount: "❌ Por favor elige una opción o introduce una cantidad válida.",
    pleaseSelectCategory: "❌ Por favor elige una categoría de la lista.",
    pleaseTap: "❌ Por favor pulsa ",
    enterValidAmount: "❌ Introduce una cantidad válida o usa los botones.",
    
    // Errores del sistema
    configValidationFailed: "❌ Falló la validación de configuración:",
    errorInitializingDatabase: "❌ Error al inicializar la base de datos:",
    networkError: "🌐 Error de red. Por favor verifica tu conexión.",
    
    // Errores de transacción
    errorUpdatingTransaction: "❌ Error al actualizar la transacción.",
    
    // Errores FX
    failedPersistCache: "❌ Error al persistir caché FX:",
    failedLoadCache: "❌ Error al cargar caché FX persistida:",
    failedAutoRefresh: "❌ Error al actualizar automáticamente tipos de cambio FX:",
    failedPreloadRates: "❌ Error al precargar tipos de cambio FX:",
    failedClearCache: "❌ Error al limpiar caché persistida:",
    
    // Automatización
    disableAutoPayment: "❌ Desactivar pago automático",
    disableAutoDeposit: "❌ Desactivar depósito automático",
    disableAutoIncome: "❌ Desactivar ingreso automático",
    disableNotifications: "❌ Desactivar notificaciones",
    
    // Recordatorios
    failedSnoozeReminder: "❌ Error al posponer recordatorio",
    failedMarkReminderDone: "❌ Error al marcar recordatorio como hecho",
    
    // Importar/Exportar
    importCancelled: "❌ Importación cancelada",
    
    // FFmpeg
    ffmpegDidNotCreate: "❌ FFmpeg no creó el archivo de salida",
    wavFileEmpty: "❌ El archivo WAV está vacío (0 bytes)",
    ffmpegConversionError: "❌ Error de conversión FFmpeg:",
    
    // AssemblyAI
    assemblyAIUploadError: "❌ Error de subida AssemblyAI:",
    assemblyAIError: "❌ Error de AssemblyAI:",
    
    // Bot
    failedStartBot: "❌ Error al iniciar el bot:",
    
    // Plantilla
    failedUpdateTemplate: "❌ Error al actualizar la plantilla.",
    
    // Acciones
    cancel: "❌ Cancelar",
    enterDifferentAmount: "❌ No, introducir cantidad diferente",
    differentAmount: "❌ No, otra cantidad",
  },

  // Éxito (NUEVA SECCIÓN)
  success: {
    // FX
    metricsReset: "✅ ¡Métricas FX reiniciadas!\n\nTodos los contadores se han reiniciado a cero.",
    ratesRefreshed: "✅ Tipos de cambio actualizados",
    usingPersistedRates: "✅ Usando tipos de cambio FX persistidos (no se necesita llamada a la API)",
    ratesPreloaded: "✅ Tipos de cambio FX precargados con éxito",
    persistedCacheCleared: "✅ Caché FX persistida limpiada",
    usingPersistedCache: "✅ Usando caché FX persistida (sin llamada a la API)",
    
    // Consulta
    queryStatsReset: "✅ ¡Estadísticas de consultas reiniciadas!\n\nTodos los contadores de consultas se han reiniciado a cero.",
    queryMonitorReset: "✅ Estadísticas del monitor de consultas reiniciadas",
    
    // Base de datos
    databaseInitialized: "✅ Base de datos inicializada con éxito (modo WAL activado)",
    databaseClosed: "✅ Conexión de base de datos cerrada",
    
    // Bot
    botStopped: "✅ Bot detenido",
    
    // Recordatorios
    remindersDisabledDeadline: "✅ Recordatorios desactivados y fecha límite eliminada.",
    remindersDisabledDueDate: "✅ Recordatorios desactivados y fecha de vencimiento eliminada.",
    reminderMarkedDone: "✅ Recordatorio marcado como hecho",
    dueDateRemoved: "✅ Fecha de vencimiento y recordatorios eliminados.",
    deadlineRemoved: "✅ Fecha límite y recordatorios eliminados.",
    
    // Automatización
    enableAutoPayment: "✅ Activar pago automático",
    enableAutoDeposit: "✅ Activar depósito automático",
    enableAutoIncome: "✅ Activar ingreso automático",
    enableNotifications: "✅ Activar notificaciones",
    
    // Programador
    schedulerStarted: "✅ Programador iniciado con éxito",
    schedulerStopped: "✅ Programador detenido",
    
    // Actualizaciones
    accountUpdated: "✅ Cuenta actualizada",
    debtAmountUpdated: "✅ ¡Cantidad de deuda actualizada!",
    goalTargetUpdated: "✅ ¡Objetivo actualizado!",
    
    // Estados
    noActiveDebts: "✅ ¡No hay deudas activas!\n\n",
    
    // AssemblyAI
    assemblyAITranscription: "✅ Transcripción AssemblyAI:",
    assemblyAIConfigured: "✅ Servicio AssemblyAI configurado",
    
    // General
    yes: "✅ Sí, es",
    done: "✅ Hecho",
  },

  // Advertencias (NUEVA SECCIÓN)
  warnings: {
    noBalancesAdd: "⚠️ No se encontraron saldos. Añade uno en 💳 Saldos.",
    noBalancesFound: "⚠️ No se encontraron saldos",
    noBalancesFoundTitle: "⚠️ *No se encontraron saldos*\n\n",
    noAccountsCreate: "⚠️ No se encontraron cuentas. Por favor crea una cuenta de saldo primero.",
    
    usingFallbackRates: "⚠️ Usando tipos de cambio de respaldo.",
    cacheExpired: "⚠️ Caché FX persistida expirada",
    
    autoPaymentOnlyForDebts: "⚠️ Pago automático solo disponible para deudas que tú debes.",
    
    assemblyAINotConfigured: "⚠️ AssemblyAI no configurado. Archivo de voz:",
    assemblyAINotConfiguredEnv: "⚠️ AssemblyAI no configurado. Establece ASSEMBLYAI_API_KEY en el entorno.",
  },

  // Mensajes (NUEVA SECCIÓN)
  messages: {
    voiceTranscriptionUnavailable: "🔑 Transcripción de voz no disponible. Por favor contacta con soporte.",
    installFFmpeg: "📦 Instalar: brew install ffmpeg (macOS) o apt-get install ffmpeg (Linux)",
    setAssemblyAIKey: "💡 Establece ASSEMBLYAI_API_KEY para activar la transcripción de voz",
    transactionHistoryEmpty: "📖 *Historial de transacciones*\n\n💭 Aún no hay transacciones.",
    advancedSettings: "🛠️ *Ajustes avanzados*\n\nFunciones avanzadas y gestión de datos:",
    goalsNoActive: "🎯 *Objetivos*\n\nNo hay objetivos activos. ¡Establece uno para empezar a ahorrar!",
  },

  // Funciones automáticas
  autoFeatures: {
    // Pago automático
    enableAutoPayment: "✅ Activar pago automático",
    disableAutoPayment: "❌ Desactivar pago automático",
    autoPaymentEnabled: "✅ Pago automático activado",
    autoPaymentDisabled: "❌ Pago automático desactivado",
    onlyForDebtsYouOwe: "⚠️ Pago automático solo disponible para deudas que tú debes.",
    
    // Depósito automático
    enableAutoDeposit: "✅ Activar depósito automático",
    disableAutoDeposit: "❌ Desactivar depósito automático",
    autoDepositEnabled: "✅ Depósito automático activado",
    autoDepositDisabled: "❌ Depósito automático desactivado",
    
    // Fechas límite
    setDeadline: "📅 Establecer fecha límite",
    changeDeadline: "📅 Cambiar fecha límite",
    monthly: "📅 Mensual",
  },

  // Inicio rápido
  quickStart: {
    noBalancesTitle: "⚠️ *No se encontraron saldos*",
    beforeAddingDebts: "Necesitas al menos una cuenta antes de añadir transacciones.",
    title: "💡 *Inicio rápido:*",
    step1: "1️⃣ Ve a 💰 *Saldos*",
    step2: "2️⃣ Pulsa ✨ *Añadir saldo*",
    step3: "3️⃣ Introduce el nombre de la cuenta y la cantidad",
  },

  // Fechas
  dates: {
    invalidFormatExample: "❌ Formato de fecha inválido. Usa DD.MM.AAAA (ej. 31.12.2026)",
    invalidFormatExampleShort: "❌ Formato de fecha inválido. Usa DD.MM.AAAA (ej. 31.12.2026) o pulsa Omitir.",
    deadlineCannotBePast: "❌ La fecha límite no puede estar en el pasado.",
    dueDateCannotBePast: "❌ La fecha de vencimiento no puede estar en el pasado.",
  },

  // Voz
  voice: {
    transcribing: "🎤 Transcribiendo mensaje de voz...",
    recognized: "🎤 Mensaje de voz reconocido:",
    failed: "❌ Error al reconocer voz. Intenta introducir texto.",
  },

  // Importar
  import: {
    title: "📄 *Importar extracto*",
    upload: "Sube un archivo CSV, TXT o JSON de tu banco",
    supported: "*Bancos soportados:*\n• Tinkoff\n• Monobank\n• Revolut\n• Wise",
    processing: "📥 Descargando y procesando archivo...",
    preview: "📊 *Vista previa del extracto*",
    importAll: "✅ Importar todo",
    editImport: "✏️ Editar e importar",
    review: "🔍 Revisar transacciones",
    completed: "✅ *¡Importación completada!*",
    imported: "Importado: {count}",
    skipped: "Omitido (inválido): {count}",
    errors: "Errores: {count}",
    time: "⚡ Tiempo: {ms}ms",
    unsupportedFormat: "⚠️ *Formato de archivo no soportado*\n\nFormatos soportados:\n• CSV (Tinkoff, Monobank, Revolut)\n• TXT (Wise)\n• JSON (Monobank)",
    noTransactions: "❌ No se encontraron transacciones en el archivo",
    parsingErrors: "⚠️ *Errores de análisis:*",
  },

  // Patrimonio neto
  netWorth: {
    title: "💎 *Patrimonio neto*",
    viewAssets: "💳 Activos",
    viewDebts: "💰 Deudas",
    fullReport: "📋 Informe completo",
    summary: "📊 Resumen",
  },

  // Automatización
  automation: {
    title: "🤖 *Automatización*",
    description: "Gestiona funciones automatizadas:",
    notifications: "🔔 Notificaciones",
    recurringPayments: "🔁 Pagos recurrentes",
  },

  // Avanzado
  advanced: {
    title: "🛠️ *Ajustes avanzados*",
    description: "Funciones avanzadas y gestión de datos:",
    customMessages: "📝 Mensajes personalizados",
    uploadStatement: "📥 Subir extracto",
    clearData: "🗑️ Borrar todos los datos",
  },
}
