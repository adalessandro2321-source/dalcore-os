import React from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { loadTransactions, toExportRows, SOURCES } from "@/lib/transactions";
import { formatCurrency } from "@/components/shared/DateFormatter";
import TransactionsTable from "@/components/finance/TransactionsTable";

export default function AllTransactions() {
  const [search, setSearch] = React.useState("");
  const [source, setSource] = React.useState("all");
  const [project, setProject] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["allTransactions"],
    queryFn: loadTransactions,
    staleTime: 5 * 60 * 1000,
  });

  const projectOptions = React.useMemo(() => {
    const set = new Set(rows.map((r) => r.project).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (source !== "all" && r.source !== source) return false;
      if (project !== "all" && r.project !== project) return false;
      if (dateFrom && r.date && r.date < dateFrom) return false;
      if (dateTo && r.date && r.date > dateTo) return false;
      if (!term) return true;
      return `${r.transaction} ${r.description} ${r.category} ${r.project} ${r.allocation}`
        .toLowerCase()
        .includes(term);
    });
  }, [rows, search, source, project, dateFrom, dateTo]);

  const totals = React.useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    filtered.forEach((r) => {
      if (r.amount >= 0) inflow += r.amount;
      else outflow += Math.abs(r.amount);
    });
    return { inflow, outflow, net: inflow - outflow };
  }, [filtered]);

  const handleExport = () => {
    const data = toExportRows(filtered);
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 36 },
      { wch: 14 },
      { wch: 18 },
      { wch: 28 },
      { wch: 42 },
      { wch: 34 },
      { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `DALCORE-Transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">All Transactions</h2>
          <p className="text-gray-600 mt-1">
            Every cost, payment, and bill across the platform — job costs, overhead, and wages
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={isLoading || filtered.length === 0}
          className="bg-[#0E351F] hover:bg-[#3B5B48] text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Spreadsheet
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Money In</p>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totals.inflow)}</p>
              </div>
              <ArrowDownCircle className="w-7 h-7 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Money Out</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(totals.outflow)}</p>
              </div>
              <ArrowUpCircle className="w-7 h-7 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Net ({filtered.length.toLocaleString()} rows)</p>
                <p className={`text-2xl font-bold ${totals.net < 0 ? "text-red-700" : "text-gray-900"}`}>
                  {formatCurrency(totals.net)}
                </p>
              </div>
              <Wallet className="w-7 h-7 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white border-[#C9C8AF]"
              />
            </div>

            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="bg-white border-[#C9C8AF]">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#C9C8AF]">
                <SelectItem value="all">All sources</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={project} onValueChange={setProject}>
              <SelectTrigger className="bg-white border-[#C9C8AF]">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#C9C8AF]">
                <SelectItem value="all">All projects &amp; allocations</SelectItem>
                {projectOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white border-[#C9C8AF]"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-white border-[#C9C8AF]"
            />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Amounts are signed: negative is money out, positive is money in. The Cash Register mirrors bank
            activity, so filter by Source to avoid overlap with bills and costs.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-[#0E351F] rounded-full animate-spin" />
            </div>
          ) : (
            <TransactionsTable rows={filtered} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}