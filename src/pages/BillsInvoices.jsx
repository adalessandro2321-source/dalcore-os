import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText, Plus, Edit, Trash2 } from "lucide-react";
import DataTable from "../components/shared/DataTable";
import StatusBadge from "../components/shared/StatusBadge";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";

export default function BillsInvoices() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date'),
  });

  const { data: bills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['bills'],
    queryFn: () => base44.entities.Bill.list('-created_date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || '-';
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || '-';
  };

  // Calculate Invoice (AR) totals
  const totalInvoiced = invoices
    .filter(i => ['Sent', 'Partial', 'Paid'].includes(i.status))
    .reduce((sum, i) => sum + (i.total || 0), 0);
  
  const arOpen = invoices
    .filter(i => ['Sent', 'Partial'].includes(i.status))
    .reduce((sum, i) => sum + (i.balance_open || 0), 0);

  const arOverdue = invoices
    .filter(i => i.due_date && new Date(i.due_date) < new Date() && ['Sent', 'Partial'].includes(i.status))
    .reduce((sum, i) => sum + (i.balance_open || 0), 0);

  // Calculate Bill (AP) totals
  const totalBilled = bills
    .filter(b => ['Approved', 'Partial', 'Paid'].includes(b.status))
    .reduce((sum, b) => sum + (b.amount || 0), 0);
  
  const apOpen = bills
    .filter(b => ['Approved', 'Partial'].includes(b.status))
    .reduce((sum, b) => sum + (b.balance_open || 0), 0);

  const apOverdue = bills
    .filter(b => b.due_date && new Date(b.due_date) < new Date() && ['Approved', 'Partial'].includes(b.status))
    .reduce((sum, b) => sum + (b.balance_open || 0), 0);

  // Invoice columns
  const invoiceColumns = [
    {
      header: "Invoice #",
      accessorKey: "number",
      cell: (row) => <span className="font-medium">{row.number || '-'}</span>
    },
    {
      header: "Project",
      accessorKey: "project_id",
      cell: (row) => <span className="text-gray-900">{getProjectName(row.project_id)}</span>
    },
    {
      header: "Client",
      accessorKey: "client_id",
      cell: (row) => <span className="text-gray-600">{getCompanyName(row.client_id)}</span>
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: "Total",
      accessorKey: "total",
      cell: (row) => <span className="font-medium">{formatCurrency(row.total)}</span>
    },
    {
      header: "Balance",
      accessorKey: "balance_open",
      cell: (row) => {
        const balance = row.balance_open || 0;
        return (
          <span className={balance > 0 ? 'text-orange-600 font-medium' : 'text-gray-900'}>
            {formatCurrency(balance)}
          </span>
        );
      }
    },
    {
      header: "Due Date",
      accessorKey: "due_date",
      cell: (row) => formatDate(row.due_date)
    },
    {
      header: "Actions",
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              navigate(createPageUrl(`InvoiceDetail?id=${row.id}`));
            }}
            className="text-gray-600 hover:text-[#1B4D3E]"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  // Bill columns
  const billColumns = [
    {
      header: "Bill #",
      accessorKey: "number",
      sortable: true,
      cell: (row) => <span className="font-medium">{row.number || '-'}</span>
    },
    {
      header: "Project",
      accessorKey: "project_id",
      sortable: true,
      cell: (row) => <span className="text-gray-900">{getProjectName(row.project_id)}</span>
    },
    {
      header: "Vendor",
      accessorKey: "vendor_id",
      sortable: true,
      cell: (row) => <span className="text-gray-600">{getCompanyName(row.vendor_id)}</span>
    },
    {
      header: "Status",
      accessorKey: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: "Amount",
      accessorKey: "amount",
      sortable: true,
      cell: (row) => <span className="font-medium">{formatCurrency(row.amount)}</span>
    },
    {
      header: "Balance",
      accessorKey: "balance_open",
      sortable: true,
      cell: (row) => {
        const balance = row.balance_open || 0;
        return (
          <span className={balance > 0 ? 'text-orange-600 font-medium' : 'text-gray-900'}>
            {formatCurrency(balance)}
          </span>
        );
      }
    },
    {
      header: "Due Date",
      accessorKey: "due_date",
      sortable: true,
      cell: (row) => formatDate(row.due_date)
    },
    {
      header: "Actions",
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              navigate(createPageUrl(`BillDetail?id=${row.id}`));
            }}
            className="text-gray-600 hover:text-[#1B4D3E]"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bills & Invoices</h2>
          <p className="text-gray-600 mt-1">Accounts payable and receivable</p>
        </div>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="bg-[#F5F4F3] border border-gray-200">
          <TabsTrigger value="invoices" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Invoices (AR)
          </TabsTrigger>
          <TabsTrigger value="bills" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            Bills (AP)
          </TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => navigate(createPageUrl('CreateInvoice'))}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </div>

          {/* AR Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-1">Total Invoiced</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalInvoiced)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-1">Outstanding (AR Open)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(arOpen)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-1">Overdue</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(arOverdue)}
                </p>
              </CardContent>
            </Card>
          </div>

          <DataTable
            columns={invoiceColumns}
            data={invoices}
            isLoading={loadingInvoices}
            onRowClick={(invoice) => navigate(createPageUrl(`InvoiceDetail?id=${invoice.id}`))}
            emptyMessage="No invoices yet. Create your first invoice."
            searchPlaceholder="Search invoices..."
            statusFilter={{
              field: 'status',
              options: ['Draft', 'Sent', 'Partial', 'Paid', 'Void']
            }}
          />
        </TabsContent>

        {/* Bills Tab */}
        <TabsContent value="bills" className="space-y-6">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => navigate(createPageUrl('CreateBill'))}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Bill
            </Button>
          </div>

          {/* AP Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-1">Total Billed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalBilled)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-1">Outstanding (AP Open)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(apOpen)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-1">Overdue</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(apOverdue)}
                </p>
              </CardContent>
            </Card>
          </div>

          <DataTable
            columns={billColumns}
            data={bills}
            isLoading={loadingBills}
            onRowClick={(bill) => navigate(createPageUrl(`BillDetail?id=${bill.id}`))}
            emptyMessage="No bills yet. Create your first bill."
            searchPlaceholder="Search bills..."
            statusFilter={{
              field: 'status',
              options: ['Draft', 'Pending', 'Approved', 'Partial', 'Paid', 'Void']
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}