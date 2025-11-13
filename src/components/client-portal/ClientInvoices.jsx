import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "../shared/StatusBadge";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import { Download, DollarSign, AlertCircle, CheckCircle } from "lucide-react";

export default function ClientInvoices({ invoices, company }) {
  const handleDownload = (invoice) => {
    // In a real implementation, this would generate/download a PDF
    alert(`Download invoice ${invoice.number}`);
  };

  if (invoices.length === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="p-12 text-center">
          <DollarSign className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">No invoices yet</p>
        </CardContent>
      </Card>
    );
  }

  const unpaidInvoices = invoices.filter(inv => inv.status !== 'Paid');
  const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => 
    sum + (inv.balance_open || inv.total || 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Outstanding Balance</p>
                <p className="text-3xl font-bold text-orange-600">
                  {formatCurrency(totalOutstanding)}
                </p>
                <p className="text-xs text-gray-600 mt-1">{unpaidInvoices.length} unpaid</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Invoiced</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total || 0), 0))}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Paid Invoices</p>
                <p className="text-3xl font-bold text-green-600">{paidInvoices.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unpaid Invoices */}
      {unpaidInvoices.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle>Unpaid Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200">
              {unpaidInvoices.map((invoice) => (
                <div key={invoice.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {invoice.number}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Due: {formatDate(invoice.due_date) || 'Not set'}
                      </p>
                    </div>
                    <StatusBadge status={invoice.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(invoice.total || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Balance Due</p>
                      <p className="font-semibold text-orange-600">
                        {formatCurrency(invoice.balance_open || invoice.total || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Invoice Date</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(invoice.created_date)}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleDownload(invoice)}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Invoice
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paid Invoices */}
      {paidInvoices.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle>Paid Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200">
              {paidInvoices.map((invoice) => (
                <div key={invoice.id} className="p-6 hover:bg-gray-50 opacity-75">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{invoice.number}</h3>
                      <p className="text-sm text-gray-600">
                        Paid: {formatDate(invoice.paid_at)}
                      </p>
                    </div>
                    <StatusBadge status={invoice.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Amount</p>
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(invoice.total || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Invoice Date</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(invoice.created_date)}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleDownload(invoice)}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Invoice
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}