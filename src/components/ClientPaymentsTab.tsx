import React from "react";
import { Application, PortalUser } from "../types";
import { CreditCard, Lock, Printer, AlertCircle, Calendar, ArrowRight } from "lucide-react";

interface ClientPaymentsTabProps {
  application: Application;
  currentUser: PortalUser | null;
  totalRentDue: number;
  totalPaid: number;
  balanceOutstanding: number;
  yearlyRent: number;
  currentLeaseYear: number;
  activePaymentsList: any[];
  paymentError: string;
  installmentAmount: string;
  setInstallmentAmount: (val: string) => void;
  installmentReceiptNo: string;
  setInstallmentReceiptNo: (val: string) => void;
  installmentMode: "Mobile Money" | "Bank Deposit" | "Salary Deduction" | "Cash";
  setInstallmentMode: (val: any) => void;
  installmentDate: string;
  setInstallmentDate: (val: string) => void;
  installmentNotes: string;
  setInstallmentNotes: (val: string) => void;
  isUpdating: boolean;
  handleAddInstallment: (e: React.FormEvent) => void;
  setSelectedReceiptToPrint: (val: any) => void;
  setShowRenewalModal: (val: boolean) => void;
}

export default function ClientPaymentsTab({
  application,
  currentUser,
  totalRentDue,
  totalPaid,
  balanceOutstanding,
  yearlyRent,
  currentLeaseYear,
  activePaymentsList,
  paymentError,
  installmentAmount,
  setInstallmentAmount,
  installmentReceiptNo,
  setInstallmentReceiptNo,
  installmentMode,
  setInstallmentMode,
  installmentDate,
  setInstallmentDate,
  installmentNotes,
  setInstallmentNotes,
  isUpdating,
  handleAddInstallment,
  setSelectedReceiptToPrint,
  setShowRenewalModal,
}: ClientPaymentsTabProps) {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 text-left animate-fade-in" id="client-payments-tab">
      {/* Financial summary metrics & ledger */}
      <div className="md:col-span-7 space-y-4">
        {/* Financial Summary Dashboard */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <span className="text-[9px] text-slate-400 font-bold block uppercase">Total Dues</span>
            <span className="text-base font-extrabold text-slate-800 font-mono block mt-1">{totalRentDue} GHS</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">({yearlyRent} GHS/yr)</span>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
            <span className="text-[9px] text-emerald-600 font-bold block uppercase">Total Paid</span>
            <span className="text-base font-extrabold text-emerald-700 font-mono block mt-1">{totalPaid} GHS</span>
            <span className="text-[9px] text-emerald-500 block mt-0.5">({activePaymentsList.length} receipts)</span>
          </div>
          <div className={`border rounded-xl p-3 ${balanceOutstanding > 0 ? "bg-amber-50 border-amber-150" : "bg-emerald-50 border-emerald-150"}`}>
            <span className={`text-[9px] font-bold block uppercase ${balanceOutstanding > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              Outstanding
            </span>
            <span className={`text-base font-extrabold font-mono block mt-1 ${balanceOutstanding > 0 ? "text-amber-800" : "text-emerald-850"}`}>
              {balanceOutstanding} GHS
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              {balanceOutstanding > 0 ? "Installments Active" : "Fully Settled"}
            </span>
          </div>
        </div>

        {/* Ledger Receipts table */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-1">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Carbon-Copy Receipt Ledger</h5>
            <span className="text-[10px] text-slate-400 font-semibold">{activePaymentsList.length} Receipts Registered</span>
          </div>

          {activePaymentsList.length > 0 ? (
            <div className="border border-slate-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-slate-50/50">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200/60">
                    <th className="p-3 font-bold uppercase text-[9px]">Date</th>
                    <th className="p-3 font-bold uppercase text-[9px]">Receipt No</th>
                    <th className="p-3 font-bold uppercase text-[9px]">Amount Paid</th>
                    <th className="p-3 font-bold uppercase text-[9px] text-right">Duplicate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50">
                  {activePaymentsList.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50 text-slate-700">
                      <td className="p-3 font-mono font-medium text-slate-500">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="p-3 font-bold font-mono text-slate-800">
                        {payment.manualReceiptNo}
                      </td>
                      <td className="p-3 font-extrabold text-emerald-700 font-mono">
                        {payment.amountPaid} GHS
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptToPrint(payment)}
                          className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-colors active:scale-95 shadow-sm"
                        >
                          <Printer className="w-3 h-3 text-slate-500" />
                          <span>View duplicate</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto stroke-1 mb-2" />
              <span className="font-semibold block">No payments logged yet</span>
              <p className="text-[11px] text-slate-400 mt-1">Receipt copies will appear in the ledger once compiled and registered by the cashier.</p>
            </div>
          )}
        </div>
      </div>

      {/* Logging of installments Form column */}
      <div className="md:col-span-5 space-y-4">
        {(application.status === "AWAITING_PAYMENT" || application.status === "OCCUPIED") ? (
          (() => {
            const canPay = currentUser?.role === "FINANCIAL_OFFICER" || currentUser?.role === "SUPER_USER";
            if (!canPay) {
              return (
                <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="bg-slate-100 text-slate-500 rounded-xl p-3 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold leading-none">Cashier Registry Locked</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Requires Cashier Authorization</p>
                    </div>
                  </div>
                  <p className="text-[11px] leading-normal text-slate-500">
                    Only registered **Financial Officers (Treasury Cashiers)** or Administrators can log manual booklet receipts.
                  </p>
                </div>
              );
            }

            return (
              <div className="bg-white border border-indigo-150 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white rounded-xl p-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 shrink-0 text-emerald-100" />
                  <div>
                    <h4 className="text-xs font-bold leading-none">Log Rent Installment</h4>
                    <p className="text-[10px] text-emerald-100 mt-1">Track physical receipt duplicate</p>
                  </div>
                </div>

                {paymentError && (
                  <div className="bg-red-50 border border-red-150 rounded-xl p-3 text-xs text-red-800 flex gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{paymentError}</span>
                  </div>
                )}

                <form onSubmit={handleAddInstallment} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Amount Paid (GHS)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={balanceOutstanding > 0 ? balanceOutstanding : undefined}
                      placeholder="e.g. 500"
                      value={installmentAmount}
                      onChange={e => setInstallmentAmount(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono text-xs bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Manual Booklet Receipt No.</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NMA-REC-2026-09"
                      value={installmentReceiptNo}
                      onChange={e => setInstallmentReceiptNo(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono text-xs uppercase bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Payment Mode</label>
                    <select
                      value={installmentMode}
                      onChange={e => setInstallmentMode(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs text-slate-700"
                    >
                      <option value="Cash">Cash booklet receipt</option>
                      <option value="Bank Deposit">Bank deposit booklet receipt</option>
                      <option value="Mobile Money">Mobile money booklet receipt</option>
                      <option value="Salary Deduction">Salary deduction coupon</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Payment Date</label>
                    <input
                      type="date"
                      value={installmentDate}
                      onChange={e => setInstallmentDate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Notes / Specifics (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. First quarter partial installment"
                      value={installmentNotes}
                      onChange={e => setInstallmentNotes(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-xs bg-slate-50/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 active:scale-[0.99]"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isUpdating ? "Logging Payment..." : "Log Installment & Register"}</span>
                  </button>
                </form>
              </div>
            );
          })()
        ) : (
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-slate-500 space-y-2">
            <div className="flex items-center gap-2 text-indigo-900">
              <Lock className="w-5 h-5 text-slate-400" />
              <span className="font-bold text-xs">Payment Stage Pending</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              You cannot log rent payments or installment receipts until the tenancy lease agreement has been prepared, approved, and digitally signed in the **Lease Agreement** tab.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
