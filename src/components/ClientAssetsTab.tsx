import React, { useState } from "react";
import { Application, Asset, PortalUser, RentRatesSetting } from "../types";
import { Building, Lock, ShieldAlert, MapPin, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { getCentralRentRate } from "../utils/rentUtils";

interface ClientAssetsTabProps {
  application: Application;
  assignedAssetsList: Asset[];
  assets: Asset[];
  assetCode: string;
  setAssetCode: (val: string) => void;
  useManualCode: boolean;
  setUseManualCode: (val: boolean) => void;
  allocationError: string;
  isUpdating: boolean;
  handleAllocate: () => void;
  setBaseRent: (val: number) => void;
  currentUser: PortalUser | null;
  rentRates?: RentRatesSetting | null;
  handleUnlinkAsset?: (asset?: Asset) => void;
}

export default function ClientAssetsTab({
  application,
  assignedAssetsList,
  assets,
  assetCode,
  setAssetCode,
  useManualCode,
  setUseManualCode,
  allocationError,
  isUpdating,
  handleAllocate,
  setBaseRent,
  currentUser,
  rentRates,
  handleUnlinkAsset,
}: ClientAssetsTabProps) {
  const [matchCategoryOnly, setMatchCategoryOnly] = useState(true);

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 text-left animate-fade-in" id="client-assets-tab">
      {/* Linked Assets List Section */}
      <div className="md:col-span-7 space-y-4">
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-200/60 pb-2 mb-3">
            <span>Allocated Physical Spaces</span>
            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-150 font-extrabold text-[10px] rounded-full text-indigo-700">
              {assignedAssetsList.length} Linked
            </span>
          </h4>

          {assignedAssetsList.length > 0 ? (
            <div className="space-y-3">
              {assignedAssetsList.map(asset => (
                <div key={asset.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-extrabold text-slate-800 text-sm block">{asset.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono mt-0.5">Asset ID: <strong className="text-indigo-650">{asset.id}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase border ${
                        asset.status === "OCCUPIED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-indigo-50 text-indigo-700 border-indigo-100"
                      }`}>
                        {asset.status}
                      </span>
                      {handleUnlinkAsset && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUnlinkAsset(asset)}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[10px] rounded-lg border border-red-200 transition-all cursor-pointer"
                          title="Unlink and return this physical asset to vacant status"
                        >
                          Unlink Store
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500 font-mono">
                    <span>Lessor Base Rent Rate</span>
                    <span className="font-extrabold text-slate-800 text-sm">{getCentralRentRate(asset.subType, rentRates)} GHS/month</span>
                  </div>
                </div>
              ))}
            </div>
          ) : application.assetCode ? (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Assigned Store Code</span>
                  <span className="text-sm font-bold font-mono text-indigo-900 block">{application.assetCode}</span>
                </div>
                {handleUnlinkAsset && (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleUnlinkAsset()}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-lg border border-red-200 transition-all cursor-pointer"
                  >
                    Unlink Store
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-8 bg-white rounded-xl text-slate-400 text-xs border border-dashed border-slate-200">
              <Building className="w-10 h-10 text-slate-300 mx-auto stroke-1 mb-2" />
              <span className="font-semibold block">No physical spaces linked yet</span>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">Allocating a physical asset code will link the client registry folder with a specific municipal space.</p>
            </div>
          )}
        </div>
      </div>

      {/* Allocation Action Column */}
      <div className="md:col-span-5 space-y-4">
        {application.status === "PENDING_ALLOCATION" ? (
          (() => {
            const vacantAssets = assets.filter(
              a => (!matchCategoryOnly || a.categoryId === application.categoryId) && a.status === "VACANT"
            );
            const hasVacantAssets = vacantAssets.length > 0;
            const canAllocate = currentUser?.role === "LEASING_OFFICER" || currentUser?.role === "SUPER_USER";

            if (!canAllocate) {
              return (
                <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="bg-slate-100 text-slate-500 rounded-xl p-3 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold leading-none">Allocation Action Locked</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Requires Leasing Officer Clearance</p>
                    </div>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-1.5 leading-normal">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Only registered **Leasing Officers** or Administrators can perform physical space allocations.</span>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="bg-indigo-900 text-white rounded-xl p-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold leading-none">Execute Stage 2: Allocation</h4>
                    <p className="text-[10px] text-indigo-100 mt-1">Link vacant space code to client</p>
                  </div>
                </div>

                {allocationError && (
                  <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {allocationError}
                  </p>
                )}

                {/* Track match toggle checkbox */}
                <div className="flex items-center gap-2 px-1.5 py-1 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                  <input
                    type="checkbox"
                    id="match-category-tab-checkbox"
                    checked={matchCategoryOnly}
                    onChange={e => setMatchCategoryOnly(e.target.checked)}
                    className="rounded text-indigo-900 focus:ring-indigo-900 h-3.5 w-3.5 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="match-category-tab-checkbox" className="text-[10px] font-bold text-indigo-950 cursor-pointer select-none">
                    Filter: Match track category only
                  </label>
                </div>

                {hasVacantAssets && !useManualCode ? (
                  <div className="space-y-1.5 text-xs">
                    <label className="font-bold text-slate-600">Available Registered Assets</label>
                    <select
                      value={assetCode}
                      onChange={e => {
                        const code = e.target.value;
                        setAssetCode(code);
                        const matched = vacantAssets.find(a => (a.assetCode || a.id) === code || a.id === code);
                        if (matched) {
                          setBaseRent(getCentralRentRate(matched.subType, rentRates));
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-xs bg-slate-50"
                    >
                      <option value="">-- Select Vacant Asset --</option>
                      {vacantAssets.map(asset => {
                        const codeVal = asset.assetCode || asset.id;
                        return (
                          <option key={asset.id} value={codeVal}>
                            {codeVal} - {asset.name} ({getCentralRentRate(asset.subType, rentRates)} GHS/mo)
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => setUseManualCode(true)}
                      className="text-[10px] text-indigo-600 hover:underline font-bold mt-1 block"
                    >
                      Or type custom asset code manually
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!hasVacantAssets && (
                      <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-[10px] text-amber-800 leading-relaxed">
                        ⚠️ No vacant physical assets registered for this category. You can register new units in the Asset Registry, or enter a custom code manually below.
                      </div>
                    )}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-slate-600">Manual Asset Code</label>
                        {hasVacantAssets && (
                          <button
                            type="button"
                            onClick={() => setUseManualCode(false)}
                            className="text-[10px] text-indigo-600 hover:underline font-bold"
                          >
                            Back to Selector
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={assetCode}
                        onChange={e => setAssetCode(e.target.value)}
                        placeholder={application.categoryId === "staff_bungalows" ? "e.g. NMA-BUNG-04" : application.categoryId === "assembly_grounds" ? "e.g. NMA-GRD-01" : "e.g. NAMA/ST/001 or NMA-MKT-B12"}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-xs uppercase bg-slate-50"
                      />
                      <span className="text-[9px] text-slate-400 block font-medium">
                        Enter physical store or asset identifier
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleAllocate}
                  className="w-full py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl transition-all shadow active:scale-95 flex items-center justify-center gap-1"
                >
                  Reserve Space <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })()
        ) : (
          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-xs">Allocation Phase Completed</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              This applicant's physical space has already been reserved and locked in. 
              The current asset linkage code is <strong className="text-indigo-900 font-mono text-xs bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">{application.assetCode}</strong>.
            </p>
            <p className="text-[10px] text-slate-400 leading-normal">To release this space, use the super admin settings or delete/reassign the registry folder.</p>
          </div>
        )}
      </div>
    </div>
  );
}
