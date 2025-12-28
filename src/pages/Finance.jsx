import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, FileText, Receipt, CreditCard } from "lucide-react";
import CashRegisterTab from "../components/finance/CashRegisterTab";
import ProfitLossTab from "../components/finance/ProfitLossTab";
import PerformanceObligationsTab from "../components/finance/PerformanceObligationsTab";
import OperatingExpensesTab from "../components/finance/OperatingExpensesTab";
import ReconciliationTab from "../components/finance/ReconciliationTab";

export default function Finance() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Financial Management</h2>
        <p className="text-gray-600 mt-1">Cash flow, P&L, revenue recognition, and operating expenses</p>
      </div>

      <Tabs defaultValue="pnl" className="space-y-6">
        <TabsList className="bg-[#F5F4F3] border border-gray-200">
          <TabsTrigger value="pnl" className="data-[state=active]:bg-[#0E351F] data-[state=active]:text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            P&L Statement
          </TabsTrigger>
          <TabsTrigger value="cash" className="data-[state=active]:bg-[#0E351F] data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            Cash Register
          </TabsTrigger>
          <TabsTrigger value="obligations" className="data-[state=active]:bg-[#0E351F] data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Performance Obligations
          </TabsTrigger>
          <TabsTrigger value="opex" className="data-[state=active]:bg-[#0E351F] data-[state=active]:text-white">
            <Receipt className="w-4 h-4 mr-2" />
            Operating Expenses
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="data-[state=active]:bg-[#0E351F] data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 mr-2" />
            Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pnl">
          <ProfitLossTab />
        </TabsContent>

        <TabsContent value="cash">
          <CashRegisterTab />
        </TabsContent>

        <TabsContent value="obligations">
          <PerformanceObligationsTab />
        </TabsContent>

        <TabsContent value="opex">
          <OperatingExpensesTab />
        </TabsContent>

        <TabsContent value="reconciliation">
          <ReconciliationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}