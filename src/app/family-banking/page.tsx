"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Baby,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

type AgeSegment = "child_7_13" | "teen_14_17";

type TransactionStatus = "authorized" | "declined" | "pending_approval";

interface Child {
  id: string;
  name: string;
  segment: AgeSegment;
  age: number;
  balance: number;
  cardLastFour: string;
  dailyLimit: number;
  weeklyLimit: number;
  perTxLimit: number;
  onlineAllowed: boolean;
  atmAllowed: boolean;
  blockedCategories: string[];
  requiresApprovalAbove: number;
  consentMethod: string;
  consentActive: boolean;
  kycVerified: boolean;
}

interface TransactionAttempt {
  id: string;
  childName: string;
  amount: number;
  merchant: string;
  category: string;
  status: TransactionStatus;
  reason?: string;
}

export default function FamilyBankingSimulationPage() {
  const router = useRouter();

  const [step, setStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [parentName, setParentName] = useState<string>("");
  const [parentKycDone, setParentKycDone] = useState<boolean>(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [transactions, setTransactions] = useState<TransactionAttempt[]>([]);
  const [complianceChecked, setComplianceChecked] = useState<boolean>(false);
  const [complianceIssues, setComplianceIssues] = useState<string[]>([]);

  const child7_13: Child = useMemo(
    () => ({
      id: "child-1",
      name: "Эмма",
      segment: "child_7_13",
      age: 10,
      balance: 0,
      cardLastFour: "7218",
      dailyLimit: 20,
      weeklyLimit: 50,
      perTxLimit: 10,
      onlineAllowed: false,
      atmAllowed: false,
      blockedCategories: ["gambling", "adult", "gaming", "atm", "online"],
      requiresApprovalAbove: 10,
      consentMethod: "Паспорт + селфи",
      consentActive: true,
      kycVerified: true,
    }),
    []
  );

  const teen14_17: Child = useMemo(
    () => ({
      id: "child-2",
      name: "Лиам",
      segment: "teen_14_17",
      age: 16,
      balance: 0,
      cardLastFour: "3402",
      dailyLimit: 100,
      weeklyLimit: 300,
      perTxLimit: 50,
      onlineAllowed: true,
      atmAllowed: true,
      blockedCategories: ["gambling", "adult"],
      requiresApprovalAbove: 30,
      consentMethod: "Микроплатёж по карте",
      consentActive: true,
      kycVerified: true,
    }),
    []
  );

  const allSteps = [
    "Регистрация и KYC родителя",
    "Создание семьи",
    "Добавление ребёнка 7–13 с согласием родителя",
    "Добавление подростка 14–17",
    "Выпуск карт и пополнение счетов",
    "Симуляция операций",
    "Отчёт compliance",
  ];

  function reset() {
    setStep(0);
    setIsRunning(false);
    setParentName("");
    setParentKycDone(false);
    setChildren([]);
    setTransactions([]);
    setComplianceChecked(false);
    setComplianceIssues([]);
  }

  async function runNextSimulationStep() {
    if (isRunning) return;
    setIsRunning(true);

    await new Promise((r) => setTimeout(r, 600));

    switch (step) {
      case 0: {
        setParentName("Алиса Джонсон");
        setParentKycDone(true);
        break;
      }
      case 2: {
        setChildren((prev) => [...prev, { ...child7_13, balance: 50 }]);
        break;
      }
      case 3: {
        setChildren((prev) => [...prev, { ...teen14_17, balance: 100 }]);
        break;
      }
      case 4: {
        setChildren((prev) =>
          prev.map((c) =>
            c.id === "child-1" ? { ...c, balance: 50 } : c.id === "child-2" ? { ...c, balance: 100 } : c
          )
        );
        break;
      }
      case 5: {
        const txs: TransactionAttempt[] = [
          {
            id: "tx-1",
            childName: "Эмма",
            amount: 5,
            merchant: "Продуктовый",
            category: "grocery",
            status: "authorized",
          },
          {
            id: "tx-2",
            childName: "Эмма",
            amount: 15,
            merchant: "Онлайн-игра",
            category: "gaming",
            status: "declined",
            reason: "Категория заблокирована для 7–13",
          },
          {
            id: "tx-3",
            childName: "Эмма",
            amount: 25,
            merchant: "Ресторан",
            category: "restaurant",
            status: "declined",
            reason: "Превышен дневной/пороговый лимит",
          },
          {
            id: "tx-4",
            childName: "Лиам",
            amount: 20,
            merchant: "Интернет-магазин",
            category: "online",
            status: "authorized",
          },
        ];
        setTransactions(txs);
        setChildren((prev) =>
          prev.map((c) => {
            if (c.name === "Эмма") return { ...c, balance: 45 };
            if (c.name === "Лиам") return { ...c, balance: 80 };
            return c;
          })
        );
        break;
      }
      case 6: {
        setComplianceChecked(true);
        const issues: string[] = [];
        if (!parentKycDone) issues.push("KYC родителя не пройдена");
        children.forEach((c) => {
          if (!c.consentActive) issues.push(`Нет действующего согласия родителя для ${c.name}`);
          if (c.segment === "child_7_13" && c.onlineAllowed) {
            issues.push(`У ребёнка ${c.name} (7–13) включены онлайн-платежи`);
          }
        });
        setComplianceIssues(issues);
        break;
      }
    }

    setStep((s) => Math.min(s + 1, allSteps.length));
    setIsRunning(false);
  }

  function runAll() {
    if (step >= allSteps.length) return;
    runNextSimulationStep();
  }

  useEffect(() => {
    if (step === 0 && !parentName && !isRunning) {
      // готово к запуску пользователем
    }
  }, [step, parentName, isRunning]);

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-moby-600 to-moby-700 rounded-3xl shadow-xl p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Family Banking</h1>
              <p className="opacity-90">Регуляторная симуляция: KYC, согласие родителей и возрастные ограничения</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </button>
          <button
            onClick={() => router.push("/family-banking/manual-test")}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
          >
            <Users className="w-4 h-4" />
            Ручное тестирование
          </button>
          <div className="flex-1" />
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl border border-slate-200 transition"
          >
            Сбросить
          </button>
          <button
            onClick={runAll}
            disabled={isRunning || step >= allSteps.length}
            className="inline-flex items-center gap-2 bg-moby-600 hover:bg-moby-700 disabled:bg-slate-300 text-white font-semibold px-5 py-2 rounded-xl transition"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Выполняется...
              </>
            ) : step >= allSteps.length ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Симуляция завершена
              </>
            ) : (
              <>{step === 0 ? "Запустить симуляцию" : "Следующий шаг"}</>
            )}
          </button>
        </div>

        {/* Scenario timeline */}
        <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Сценарий симуляции</h2>
          <div className="space-y-3">
            {allSteps.map((label, idx) => {
              const done = idx < step;
              const active = idx === step && step < allSteps.length;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                    done
                      ? "bg-moby-50 border-moby-200"
                      : active
                      ? "bg-amber-50 border-amber-200 ring-1 ring-amber-200"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      done
                        ? "bg-moby-600 text-white"
                        : active
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : active ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="text-sm font-bold">{idx + 1}</span>
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      done ? "text-moby-800" : active ? "text-amber-900" : "text-slate-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Parent section */}
        {parentName && (
          <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8 animate-slide-up">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-moby-100 flex items-center justify-center text-moby-600">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Родитель / владелец счёта</h3>
                <p className="text-slate-600">{parentName}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 bg-moby-100 text-moby-700 text-sm font-medium px-3 py-1 rounded-full">
                    <BadgeCheck className="w-4 h-4" />
                    KYC пройдена
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-sm font-medium px-3 py-1 rounded-full">
                    <ShieldCheck className="w-4 h-4" />
                    Проверка sanctions/PEP пройдена
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Children section */}
        {children.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children.map((child) => (
              <div
                key={child.id}
                className="bg-white rounded-3xl shadow-lg p-6 animate-slide-up"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                      <Baby className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{child.name}</h3>
                      <p className="text-sm text-slate-500">
                        {child.segment === "child_7_13" ? "Ребёнок 7–13" : "Подросток 14–17"} · {child.age} {child.age === 1 ? "год" : child.age < 5 ? "года" : "лет"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      child.consentActive
                        ? "bg-moby-100 text-moby-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {child.consentActive ? "Согласие активно" : "Согласие отозвано"}
                  </span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                  <p className="text-sm text-slate-500">Доступный баланс</p>
                  <p className="text-3xl font-bold text-slate-900">{formatBYN(child.balance)}</p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CreditCard className="w-4 h-4" />
                    Карта **** {child.cardLastFour}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Wallet className="w-4 h-4" />
                    В день {formatBYN(child.dailyLimit)} · в неделю {formatBYN(child.weeklyLimit)} · за операцию {formatBYN(child.perTxLimit)}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Lock className="w-4 h-4" />
                    Одобрение родителя свыше {formatBYN(child.requiresApprovalAbove)}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {child.onlineAllowed ? (
                      <span className="bg-moby-100 text-moby-700 text-xs font-medium px-2 py-1 rounded-md">Онлайн-платежи ВКЛ</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-md">Онлайн-платежи ВЫКЛ</span>
                    )}
                    {child.atmAllowed ? (
                      <span className="bg-moby-100 text-moby-700 text-xs font-medium px-2 py-1 rounded-md">Банкомат ВКЛ</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded-md">Банкомат ВЫКЛ</span>
                    )}
                    {child.blockedCategories.map((cat) => (
                      <span
                        key={cat}
                        className="bg-red-50 text-red-600 text-xs font-medium px-2 py-1 rounded-md"
                      >
                        {cat} заблокировано
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Способ согласия: <span className="font-medium text-slate-700">{child.consentMethod}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Transactions section */}
        {transactions.length > 0 && (
          <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-moby-600" />
              Симулированные операции
            </h2>
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
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
                        <Users className="w-5 h-5" />
                      ) : (
                        <Ban className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{tx.merchant}</p>
                      <p className="text-xs text-slate-500">
                        {tx.childName} · {tx.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatBYN(tx.amount)}</p>
                    <p
                      className={`text-xs font-medium ${
                        tx.status === "authorized"
                          ? "text-moby-700"
                          : tx.status === "pending_approval"
                          ? "text-amber-700"
                          : "text-red-700"
                      }`}
                    >
                      {tx.status === "authorized"
                        ? "Одобрено"
                        : tx.status === "pending_approval"
                        ? "Ожидает родителя"
                        : `Отклонено: ${tx.reason}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compliance report */}
        {complianceChecked && (
          <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-moby-600" />
              Отчёт compliance
            </h2>
            {complianceIssues.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-moby-50 rounded-xl border border-moby-200">
                <CheckCircle2 className="w-6 h-6 text-moby-600" />
                <p className="font-medium text-moby-800">Семья соответствует требованиям</p>
              </div>
            ) : (
              <div className="space-y-2">
                {complianceIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-200"
                  >
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <p className="text-sm text-red-800">{issue}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="font-semibold text-slate-700">GDPR / COPPA</p>
                <p className="text-slate-500">Согласие родителя зафиксировано с аудит-трейлом</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="font-semibold text-slate-700">KYC / AML</p>
                <p className="text-slate-500">Родитель верифицирован; личность ребёнка документирована</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="font-semibold text-slate-700">Возрастной дизайн</p>
                <p className="text-slate-500">Высокие настройки приватности по умолчанию по возрасту</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="font-semibold text-slate-700">Никакого кредита для несовершеннолетних</p>
                <p className="text-slate-500">Только prepaid/дебет; нет овердрафта</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
