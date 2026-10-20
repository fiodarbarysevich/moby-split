"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Baby,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CreditCard,
  Globe,
  Loader2,
  Lock,
  Plus,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

interface Jurisdiction {
  id: "gdpr" | "us" | "uk";
  name: string;
  digitalConsentAge: number;
  fullCapacityAge: number;
  parentalConsentUpTo: number;
}

const JURISDICTIONS: Jurisdiction[] = [
  { id: "gdpr", name: "GDPR (стандарт)", digitalConsentAge: 16, fullCapacityAge: 18, parentalConsentUpTo: 16 },
  { id: "us", name: "США / COPPA", digitalConsentAge: 13, fullCapacityAge: 18, parentalConsentUpTo: 13 },
  { id: "uk", name: "Великобритания", digitalConsentAge: 13, fullCapacityAge: 18, parentalConsentUpTo: 13 },
];

type ConsentMethod = "Паспорт + селфи" | "Микроплатёж по карте" | "Вопросы по кредитной истории" | "Видеозвонок" | "Подписанная форма";

interface Child {
  id: string;
  name: string;
  dateOfBirth: string;
  age: number;
  segment: "child_7_13" | "teen_14_17" | "adult";
  consentMethod: ConsentMethod;
  consentActive: boolean;
  kycVerified: boolean;
  accountActive: boolean;
  balance: number;
  cardLastFour: string;
  cardFrozen: boolean;
  dailyLimit: number;
  weeklyLimit: number;
  perTxLimit: number;
  onlineAllowed: boolean;
  atmAllowed: boolean;
  blockedCategories: string[];
  approvalThreshold: number;
}

interface Transaction {
  id: string;
  childId: string;
  childName: string;
  amount: number;
  merchant: string;
  category: string;
  status: "authorized" | "declined" | "pending_approval";
  reason?: string;
  approvedByParent?: boolean;
}

const ALL_CATEGORIES = [
  { id: "grocery", label: "Продукты" },
  { id: "restaurant", label: "Ресторан" },
  { id: "entertainment", label: "Развлечения" },
  { id: "gaming", label: "Игры" },
  { id: "gambling", label: "Азартные игры" },
  { id: "adult", label: "18+" },
  { id: "atm", label: "Банкомат" },
  { id: "online", label: "Онлайн" },
  { id: "transport", label: "Транспорт" },
  { id: "other", label: "Другое" },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getAge(dob: string) {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getSegment(age: number): Child["segment"] {
  if (age < 7) return "child_7_13";
  if (age <= 13) return "child_7_13";
  if (age <= 17) return "teen_14_17";
  return "adult";
}

function defaultLimits(segment: Child["segment"]) {
  if (segment === "child_7_13") {
    return {
      dailyLimit: 20,
      weeklyLimit: 50,
      perTxLimit: 10,
      onlineAllowed: false,
      atmAllowed: false,
      blockedCategories: ["gambling", "adult", "gaming", "atm", "online"],
      approvalThreshold: 10,
    };
  }
  return {
    dailyLimit: 100,
    weeklyLimit: 300,
    perTxLimit: 50,
    onlineAllowed: true,
    atmAllowed: true,
    blockedCategories: ["gambling", "adult"],
    approvalThreshold: 30,
  };
}

export default function FamilyBankingManualTestPage() {
  const router = useRouter();
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>(JURISDICTIONS[0]);

  const [parentName, setParentName] = useState("");
  const [parentDob, setParentDob] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentKyc, setParentKyc] = useState(false);

  const [familyName, setFamilyName] = useState("");
  const [familyCreated, setFamilyCreated] = useState(false);

  const [children, setChildren] = useState<Child[]>([]);
  const [childName, setChildName] = useState("");
  const [childDob, setChildDob] = useState("");
  const [childConsent, setChildConsent] = useState<ConsentMethod>("Паспорт + селфи");
  const [addChildError, setAddChildError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txAmount, setTxAmount] = useState("");
  const [txMerchant, setTxMerchant] = useState("");
  const [txCategory, setTxCategory] = useState("grocery");
  const [txChildId, setTxChildId] = useState("");
  const [txError, setTxError] = useState<string | null>(null);

  const [complianceIssues, setComplianceIssues] = useState<string[]>([]);

  const isParentAdult = useMemo(() => {
    if (!parentDob) return false;
    return getAge(parentDob) >= jurisdiction.fullCapacityAge;
  }, [parentDob, jurisdiction]);

  function resetAll() {
    setParentName("");
    setParentDob("");
    setParentEmail("");
    setParentKyc(false);
    setFamilyName("");
    setFamilyCreated(false);
    setChildren([]);
    setTransactions([]);
    setComplianceIssues([]);
    setAddChildError(null);
    setTxError(null);
  }

  function registerParent() {
    if (!parentName.trim() || !parentDob || !parentEmail.trim()) return;
    if (!isParentAdult) return;
    setParentKyc(true);
  }

  function createFamily() {
    if (!familyName.trim() || !parentKyc) return;
    setFamilyCreated(true);
  }

  function addChild() {
    setAddChildError(null);
    if (!childName.trim() || !childDob) {
      setAddChildError("Введите имя и дату рождения ребёнка.");
      return;
    }
    const age = getAge(childDob);
    if (age < 7) {
      setAddChildError("Сервис доступен для детей от 7 лет.");
      return;
    }
    if (age >= jurisdiction.fullCapacityAge) {
      setAddChildError(`Для пользователей ${jurisdiction.fullCapacityAge}+ используйте взрослую регистрацию.`);
      return;
    }
    const segment = getSegment(age);
    const limits = defaultLimits(segment);
    const child: Child = {
      id: generateId(),
      name: childName.trim(),
      dateOfBirth: childDob,
      age,
      segment,
      consentMethod: childConsent,
      consentActive: true,
      kycVerified: true,
      accountActive: false,
      balance: 0,
      cardLastFour: `${Math.floor(1000 + Math.random() * 9000)}`,
      cardFrozen: false,
      ...limits,
    };
    setChildren((prev) => [...prev, child]);
    setChildName("");
    setChildDob("");
  }

  function removeChild(id: string) {
    setChildren((prev) => prev.filter((c) => c.id !== id));
    setTransactions((prev) => prev.filter((t) => t.childId !== id));
  }

  function toggleAccountActive(child: Child) {
    setChildren((prev) =>
      prev.map((c) => (c.id === child.id ? { ...c, accountActive: !c.accountActive } : c))
    );
  }

  function toggleCardFreeze(child: Child) {
    setChildren((prev) =>
      prev.map((c) => (c.id === child.id ? { ...c, cardFrozen: !c.cardFrozen } : c))
    );
  }

  function loadFunds(child: Child, amount: number) {
    if (amount <= 0) return;
    setChildren((prev) =>
      prev.map((c) => (c.id === child.id ? { ...c, balance: c.balance + amount } : c))
    );
  }

  function updateLimit(child: Child, field: keyof Child, value: number | boolean | string[]) {
    setChildren((prev) =>
      prev.map((c) => (c.id === child.id ? { ...c, [field]: value } : c))
    );
  }

  function toggleConsent(child: Child) {
    setChildren((prev) =>
      prev.map((c) => (c.id === child.id ? { ...c, consentActive: !c.consentActive } : c))
    );
  }

  function getSpentInPeriod(childId: string, days: number) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    return transactions
      .filter(
        (t) =>
          t.childId === childId &&
          new Date().getTime() > since &&
          (t.status === "authorized" || (t.status === "pending_approval" && t.approvedByParent))
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }

  function attemptTransaction() {
    setTxError(null);
    const amount = parseFloat(txAmount);
    if (!txChildId || !txMerchant.trim() || !Number.isFinite(amount) || amount <= 0) {
      setTxError("Выберите ребёнка, введите магазин и положительную сумму.");
      return;
    }
    const child = children.find((c) => c.id === txChildId);
    if (!child) return;

    const tx: Transaction = {
      id: generateId(),
      childId: child.id,
      childName: child.name,
      amount,
      merchant: txMerchant.trim(),
      category: txCategory,
      status: "authorized",
    };

    if (!child.accountActive) {
      tx.status = "declined";
      tx.reason = "Счёт не активирован";
    } else if (child.cardFrozen) {
      tx.status = "declined";
      tx.reason = "Карта заморожена";
    } else if (child.blockedCategories.includes(txCategory)) {
      tx.status = "declined";
      tx.reason = `Категория '${ALL_CATEGORIES.find(c => c.id === txCategory)?.label || txCategory}' заблокирована для этой возрастной группы`;
    } else if (txCategory === "online" && !child.onlineAllowed) {
      tx.status = "declined";
      tx.reason = "Онлайн-платежи запрещены для этой возрастной группы";
    } else if (txCategory === "atm" && !child.atmAllowed) {
      tx.status = "declined";
      tx.reason = "Снятие наличных запрещено для этой возрастной группы";
    } else if (amount > child.perTxLimit) {
      tx.status = "declined";
      tx.reason = `Превышен лимит на операцию (${formatBYN(child.perTxLimit)})`;
    } else if (getSpentInPeriod(child.id, 1) + amount > child.dailyLimit) {
      tx.status = "declined";
      tx.reason = `Превышен дневной лимит (${formatBYN(child.dailyLimit)})`;
    } else if (getSpentInPeriod(child.id, 7) + amount > child.weeklyLimit) {
      tx.status = "declined";
      tx.reason = `Превышен недельный лимит (${formatBYN(child.weeklyLimit)})`;
    } else if (amount >= child.approvalThreshold) {
      tx.status = "pending_approval";
    } else if (amount > child.balance) {
      tx.status = "declined";
      tx.reason = "Недостаточно средств";
    } else {
      setChildren((prev) =>
        prev.map((c) => (c.id === child.id ? { ...c, balance: c.balance - amount } : c))
      );
    }

    setTransactions((prev) => [tx, ...prev]);
    setTxAmount("");
    setTxMerchant("");
  }

  function approveTransaction(txId: string) {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || tx.status !== "pending_approval") return;
    const child = children.find((c) => c.id === tx.childId);
    if (!child) return;
    if (tx.amount > child.balance) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txId ? { ...t, status: "declined", reason: "Недостаточно средств после одобрения" } : t
        )
      );
      return;
    }
    setChildren((prev) =>
      prev.map((c) => (c.id === child.id ? { ...c, balance: c.balance - tx.amount } : c))
    );
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: "authorized", approvedByParent: true } : t))
    );
  }

  function declineTransaction(txId: string) {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId ? { ...t, status: "declined", reason: "Отклонено родителем" } : t
      )
    );
  }

  function runComplianceCheck() {
    const issues: string[] = [];
    if (!parentKyc) issues.push("KYC родителя не пройдена.");
    if (!familyCreated) issues.push("Семья не создана.");
    children.forEach((c) => {
      if (!c.kycVerified) issues.push(`Личность ребёнка ${c.name} не подтверждена.`);
      if (!c.consentActive && c.age < jurisdiction.parentalConsentUpTo) {
        issues.push(`Нет действующего согласия родителя для ${c.name} (требуется до ${jurisdiction.parentalConsentUpTo} лет).`);
      }
      if (c.segment === "child_7_13" && c.onlineAllowed) {
        issues.push(`У ребёнка ${c.name} (7–13) включены онлайн-платежи.`);
      }
      if (c.segment === "child_7_13" && c.atmAllowed) {
        issues.push(`У ребёнка ${c.name} (7–13) включены снятия наличных.`);
      }
    });
    setComplianceIssues(issues);
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-moby-600 to-moby-700 rounded-3xl shadow-xl p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Ручное тестирование Family Banking</h1>
                <p className="opacity-90">Проверьте каждую функцию и пограничный случай</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <select
                value={jurisdiction.id}
                onChange={(e) => setJurisdiction(JURISDICTIONS.find((j) => j.id === e.target.value)!)}
                className="bg-white/20 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/40"
              >
                {JURISDICTIONS.map((j) => (
                  <option key={j.id} value={j.id} className="text-slate-900">
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="bg-white/20 px-3 py-1 rounded-full">Возраст цифрового согласия: {jurisdiction.digitalConsentAge}</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">Совершеннолетие: {jurisdiction.fullCapacityAge}</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">Согласие родителя до: {jurisdiction.parentalConsentUpTo}</span>
          </div>
        </div>

        {/* Top controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </button>
          <button
            onClick={() => router.push("/family-banking")}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
          >
            <ShieldCheck className="w-4 h-4" />
            Авто-симуляция
          </button>
          <div className="flex-1" />
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 font-semibold px-4 py-2 rounded-xl border border-red-200 transition"
          >
            <RefreshCcw className="w-4 h-4" />
            Сбросить всё
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: setup */}
          <div className="space-y-6">
            {/* Parent onboarding */}
            <div className="bg-white rounded-3xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-moby-600" />
                1. Регистрация родителя
              </h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="ФИО родителя"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none"
                />
                <input
                  type="date"
                  value={parentDob}
                  onChange={(e) => setParentDob(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none"
                />
                {parentDob && !isParentAdult && (
                  <p className="text-sm text-red-600">Родитель должен быть старше {jurisdiction.fullCapacityAge} лет.</p>
                )}
                <button
                  onClick={registerParent}
                  disabled={parentKyc || !parentName.trim() || !parentDob || !parentEmail.trim() || !isParentAdult}
                  className="w-full bg-moby-600 hover:bg-moby-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition"
                >
                  {parentKyc ? "KYC подтверждена" : "Подтвердить KYC родителя"}
                </button>
                {parentKyc && (
                  <div className="flex items-center gap-2 text-moby-700 text-sm font-medium">
                    <BadgeCheck className="w-4 h-4" />
                    {parentName} верифицирован
                  </div>
                )}
              </div>
            </div>

            {/* Family creation */}
            <div className="bg-white rounded-3xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-moby-600" />
                2. Создание семьи
              </h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Название семьи"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  disabled={!parentKyc}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none disabled:bg-slate-100"
                />
                <button
                  onClick={createFamily}
                  disabled={familyCreated || !familyName.trim() || !parentKyc}
                  className="w-full bg-moby-600 hover:bg-moby-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition"
                >
                  {familyCreated ? "Семья создана" : "Создать семью"}
                </button>
              </div>
            </div>

            {/* Add child */}
            <div className="bg-white rounded-3xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Baby className="w-5 h-5 text-moby-600" />
                3. Добавить ребёнка
              </h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Имя ребёнка"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  disabled={!familyCreated}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none disabled:bg-slate-100"
                />
                <input
                  type="date"
                  value={childDob}
                  onChange={(e) => setChildDob(e.target.value)}
                  disabled={!familyCreated}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none disabled:bg-slate-100"
                />
                <select
                  value={childConsent}
                  onChange={(e) => setChildConsent(e.target.value as ConsentMethod)}
                  disabled={!familyCreated}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none disabled:bg-slate-100"
                >
                  <option>Паспорт + селфи</option>
                  <option>Микроплатёж по карте</option>
                  <option>Вопросы по кредитной истории</option>
                  <option>Видеозвонок</option>
                  <option>Подписанная форма</option>
                </select>
                {addChildError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addChildError}</p>
                )}
                <button
                  onClick={addChild}
                  disabled={!familyCreated}
                  className="w-full bg-moby-600 hover:bg-moby-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition"
                >
                  Добавить ребёнка
                </button>
              </div>
            </div>
          </div>

          {/* Middle + right: family dashboard */}
          <div className="lg:col-span-2 space-y-6">
            {children.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-lg p-10 text-center">
                <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Пока не добавлено ни одного ребёнка. Выполните шаги 1–3, чтобы начать тестирование.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {children.map((child) => (
                  <div key={child.id} className="bg-white rounded-3xl shadow-lg p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                          <Baby className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{child.name}</h3>
                          <p className="text-sm text-slate-500">
                            {child.age} {child.age === 1 ? "год" : child.age < 5 ? "года" : "лет"} · {child.segment === "child_7_13" ? "Ребёнок 7–13" : "Подросток 14–17"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleConsent(child)}
                          className={`text-xs font-semibold px-3 py-1 rounded-full transition ${
                            child.consentActive
                              ? "bg-moby-100 text-moby-700 hover:bg-moby-200"
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
                        >
                          {child.consentActive ? "Согласие активно" : "Согласие отозвано"}
                        </button>
                        <button
                          onClick={() => removeChild(child.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                          Удалить
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-xs text-slate-500">Баланс</p>
                        <p className="text-2xl font-bold text-slate-900">{formatBYN(child.balance)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-xs text-slate-500">Карта</p>
                        <p className="text-lg font-bold text-slate-900">**** {child.cardLastFour}</p>
                        <p className={`text-xs ${child.cardFrozen ? "text-red-600" : "text-moby-600"}`}>
                          {child.cardFrozen ? "Заморожена" : "Активна"}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-xs text-slate-500">Счёт</p>
                        <p className="text-lg font-bold text-slate-900">{child.accountActive ? "Активен" : "Ожидает"}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        onClick={() => toggleAccountActive(child)}
                        className={`text-sm font-semibold px-3 py-2 rounded-xl transition ${
                          child.accountActive
                            ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            : "bg-moby-600 text-white hover:bg-moby-700"
                        }`}
                      >
                        {child.accountActive ? "Деактивировать счёт" : "Активировать счёт"}
                      </button>
                      <button
                        onClick={() => toggleCardFreeze(child)}
                        className={`text-sm font-semibold px-3 py-2 rounded-xl transition inline-flex items-center gap-1 ${
                          child.cardFrozen
                            ? "bg-moby-100 text-moby-700 hover:bg-moby-200"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {child.cardFrozen ? <CheckCircle2 className="w-4 h-4" /> : <Snowflake className="w-4 h-4" />}
                        {child.cardFrozen ? "Разморозить карту" : "Заморозить карту"}
                      </button>
                      <LoadFundsButton child={child} onLoad={(amount) => loadFunds(child, amount)} />
                    </div>

                    {/* Limits editor */}
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Лимиты и контроль</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <NumberInput
                          label="В день"
                          value={child.dailyLimit}
                          onChange={(v) => updateLimit(child, "dailyLimit", v)}
                        />
                        <NumberInput
                          label="В неделю"
                          value={child.weeklyLimit}
                          onChange={(v) => updateLimit(child, "weeklyLimit", v)}
                        />
                        <NumberInput
                          label="За операцию"
                          value={child.perTxLimit}
                          onChange={(v) => updateLimit(child, "perTxLimit", v)}
                        />
                        <NumberInput
                          label="Одобрение &gt;"
                          value={child.approvalThreshold}
                          onChange={(v) => updateLimit(child, "approvalThreshold", v)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Toggle
                          label="Онлайн"
                          value={child.onlineAllowed}
                          onChange={(v) => updateLimit(child, "onlineAllowed", v)}
                        />
                        <Toggle
                          label="Банкомат"
                          value={child.atmAllowed}
                          onChange={(v) => updateLimit(child, "atmAllowed", v)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ALL_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              const isBlocked = child.blockedCategories.includes(cat.id);
                              const next = isBlocked
                                ? child.blockedCategories.filter((c) => c !== cat.id)
                                : [...child.blockedCategories, cat.id];
                              updateLimit(child, "blockedCategories", next);
                            }}
                            className={`text-xs font-medium px-2 py-1 rounded-md transition ${
                              child.blockedCategories.includes(cat.id)
                                ? "bg-red-100 text-red-700"
                                : "bg-moby-100 text-moby-700"
                            }`}
                          >
                            {child.blockedCategories.includes(cat.id) ? "Заблокировано:" : "Разрешено:"} {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transaction tester */}
            {children.length > 0 && (
              <div className="bg-white rounded-3xl shadow-lg p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-moby-600" />
                  4. Проверить операцию
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
                  <select
                    value={txChildId}
                    onChange={(e) => setTxChildId(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none"
                  >
                    <option value="">Выберите ребёнка</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Магазин"
                    value={txMerchant}
                    onChange={(e) => setTxMerchant(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none"
                  />
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none"
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Сумма"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none"
                  />
                  <button
                    onClick={attemptTransaction}
                    className="bg-moby-600 hover:bg-moby-700 text-white font-semibold py-3 rounded-xl transition"
                  >
                    Проверить
                  </button>
                </div>
                {txError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{txError}</p>}
              </div>
            )}

            {/* Transactions log */}
            {transactions.length > 0 && (
              <div className="bg-white rounded-3xl shadow-lg p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">История операций</h2>
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
                        tx.status === "authorized"
                          ? "bg-moby-50 border-moby-200"
                          : tx.status === "pending_approval"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            tx.status === "authorized"
                              ? "bg-moby-200 text-moby-700"
                              : tx.status === "pending_approval"
                              ? "bg-amber-200 text-amber-700"
                              : "bg-red-200 text-red-700"
                          }`}
                        >
                          {tx.status === "authorized" ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : tx.status === "pending_approval" ? (
                            <ShieldAlert className="w-5 h-5" />
                          ) : (
                            <Ban className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {tx.merchant} · {formatBYN(tx.amount)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {tx.childName} · {ALL_CATEGORIES.find(c => c.id === tx.category)?.label || tx.category} ·{" "}
                            {tx.status === "authorized"
                              ? "Одобрено"
                              : tx.status === "pending_approval"
                              ? "Ожидает одобрения родителя"
                              : `Отклонено: ${tx.reason}`}
                          </p>
                        </div>
                      </div>
                      {tx.status === "pending_approval" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveTransaction(tx.id)}
                            className="inline-flex items-center gap-1 bg-moby-600 hover:bg-moby-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Одобрить
                          </button>
                          <button
                            onClick={() => declineTransaction(tx.id)}
                            className="inline-flex items-center gap-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-sm font-semibold px-3 py-2 rounded-lg transition"
                          >
                            <XCircle className="w-4 h-4" />
                            Отклонить
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compliance check */}
            {children.length > 0 && (
              <div className="bg-white rounded-3xl shadow-lg p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-moby-600" />
                  5. Проверка compliance
                </h2>
                <button
                  onClick={runComplianceCheck}
                  className="bg-moby-600 hover:bg-moby-700 text-white font-semibold px-5 py-2 rounded-xl transition"
                >
                  Запустить проверку
                </button>
                {complianceIssues.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {complianceIssues.map((issue, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                        <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                        <p className="text-sm text-red-800">{issue}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-moby-50 rounded-xl border border-moby-200">
                    <CheckCircle2 className="w-5 h-5 text-moby-600" />
                    <p className="text-sm text-moby-800">Нарушений не обнаружено (сначала запустите проверку).</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function LoadFundsButton({ child, onLoad }: { child: Child; onLoad: (amount: number) => void }) {
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-semibold px-3 py-2 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition inline-flex items-center gap-1"
      >
        <Wallet className="w-4 h-4" />
        Пополнить
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0.01"
        step="0.01"
        placeholder="Сумма"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 px-2 py-2 rounded-lg border border-slate-200 text-sm"
        autoFocus
      />
      <button
        onClick={() => {
          const value = parseFloat(amount);
          if (Number.isFinite(value) && value > 0) {
            onLoad(value);
            setAmount("");
            setOpen(false);
          }
        }}
        className="text-sm font-semibold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
      >
        Пополнить
      </button>
      <button
        onClick={() => {
          setAmount("");
          setOpen(false);
        }}
        className="text-sm font-semibold px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
      >
        Отмена
      </button>
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none"
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`text-sm font-semibold px-3 py-2 rounded-xl transition inline-flex items-center gap-1 ${
        value ? "bg-moby-100 text-moby-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {value ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {label} {value ? "ВКЛ" : "ВЫКЛ"}
    </button>
  );
}
