import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/components/shared/DateFormatter";

const PAGE_SIZE = 100;

export default function TransactionsTable({ rows }) {
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    setPage(0);
  }, [rows]);

  const total = rows.length;
  const start = page * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F5F4F3] border-b border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Transaction</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Cost Allocation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Project / Overhead</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Source</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visible.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-10 text-center text-gray-500">
                  No transactions match these filters
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.date || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.transaction || "—"}</p>
                    {r.description && (
                      <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{r.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.allocation}</td>
                  <td className="px-4 py-3 text-gray-700">{r.category}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className={r.project === "—" ? "text-gray-400" : ""}>{r.project}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.source}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                      r.amount < 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {formatCurrency(r.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            Showing {start + 1}–{Math.min(start + PAGE_SIZE, total)} of {total.toLocaleString()} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[#C9C8AF]"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-gray-600">
              Page {page + 1} of {lastPage + 1}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="border-[#C9C8AF]"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}