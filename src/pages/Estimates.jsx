import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import DataTable from "../components/shared/DataTable";
import StatusBadge from "../components/shared/StatusBadge";
import { formatDate, formatCurrency } from "../components/shared/DateFormatter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export default function Estimates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [estimateToDelete, setEstimateToDelete] = React.useState(null);

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => base44.entities.Estimate.list('-created_date'),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (estimateId) => base44.entities.Estimate.delete(estimateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      setShowDeleteConfirm(false);
      setEstimateToDelete(null);
    },
  });

  const handleRowClick = (estimate) => {
    navigate(createPageUrl(`CreateEstimate?id=${estimate.id}`));
  };

  const handleDeleteClick = (e, estimate) => {
    e.stopPropagation();
    setEstimateToDelete(estimate);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (estimateToDelete) {
      deleteMutation.mutate(estimateToDelete.id);
    }
  };

  const getOpportunityName = (opportunityId) => {
    const opp = opportunities.find(o => o.id === opportunityId);
    return opp?.name || '-';
  };

  const columns = [
    {
      header: "Number",
      accessorKey: "number",
      cell: (row) => <span className="font-mono text-sm">{row.number || '-'}</span>,
      sortable: true,
    },
    {
      header: "Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortable: true,
    },
    {
      header: "Opportunity",
      accessorKey: "opportunity_id",
      cell: (row) => getOpportunityName(row.opportunity_id),
      sortable: true,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => <StatusBadge status={row.status} />,
      sortable: true,
    },
    {
      header: "Version",
      accessorKey: "version",
      cell: (row) => <span className="text-sm">v{row.version || 1}</span>,
      sortable: true,
    },
    {
      header: "Estimated Price",
      accessorKey: "estimated_selling_price",
      cell: (row) => (
        <span className="font-semibold">{formatCurrency(row.estimated_selling_price || 0)}</span>
      ),
      sortable: true,
    },
    {
      header: "Estimated Profit",
      accessorKey: "estimated_profit",
      cell: (row) => {
        const profit = row.estimated_profit || 0;
        return (
          <span className={profit >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
            {formatCurrency(profit)}
          </span>
        );
      },
      sortable: true,
    },
    {
      header: "Created",
      accessorKey: "created_date",
      cell: (row) => formatDate(row.created_date),
      sortable: true,
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => handleDeleteClick(e, row)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
      sortable: false,
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Estimates</h2>
          <p className="text-gray-600 mt-1">View and manage all project estimates</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={estimates}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        emptyMessage="No estimates yet. Create one from an opportunity."
        searchPlaceholder="Search estimates..."
        statusFilter={{
          field: 'status',
          options: ['Draft', 'Submitted', 'Awarded', 'Lost']
        }}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{estimateToDelete?.name}</span>?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Estimate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}