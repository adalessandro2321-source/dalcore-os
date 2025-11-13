import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DataTable from "../components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from 'date-fns';

function AddEditCompanyForm({ initialData, onSubmit, onCancel, isSubmitting, isEditing }) {
  const [formData, setFormData] = React.useState(initialData || {
    name: '',
    type: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    insurance_expiry: '',
    insurance_amount: '',
    license_number: '',
    notes: ''
  });

  React.useEffect(() => {
    setFormData(initialData ? {
      ...initialData,
      insurance_expiry: initialData.insurance_expiry ? format(new Date(initialData.insurance_expiry), 'yyyy-MM-dd') : ''
    } : {
      name: '',
      type: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      insurance_expiry: '',
      insurance_amount: '',
      license_number: '',
      notes: ''
    });
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSubmitLocal = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type) {
      alert('Please fill in all required fields (Name and Type)');
      return;
    }

    const submitData = {
      ...formData,
      insurance_amount: formData.insurance_amount ? parseFloat(formData.insurance_amount) : null
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmitLocal} className="space-y-4">
      <div>
        <Label htmlFor="name">Company Name <span className="text-red-600">*</span></Label>
        <Input
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="bg-white border-gray-300 text-gray-900"
        />
      </div>

      <div>
        <Label htmlFor="type">Type <span className="text-red-600">*</span></Label>
        <Select
          value={formData.type}
          onValueChange={(value) => handleSelectChange('type', value)}
          required
        >
          <SelectTrigger id="type" className="bg-white border-gray-300 text-gray-900">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
            <SelectItem value="Owner">Owner</SelectItem>
            <SelectItem value="GC">General Contractor</SelectItem>
            <SelectItem value="Subcontractor">Subcontractor</SelectItem>
            <SelectItem value="Supplier">Supplier</SelectItem>
            <SelectItem value="Consultant">Consultant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="bg-white border-gray-300 text-gray-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            name="state"
            value={formData.state}
            onChange={handleChange}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
        <div>
          <Label htmlFor="zip">ZIP</Label>
          <Input
            id="zip"
            name="zip"
            value={formData.zip}
            onChange={handleChange}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="insurance_expiry">Insurance Expiry</Label>
          <Input
            id="insurance_expiry"
            name="insurance_expiry"
            type="date"
            value={formData.insurance_expiry}
            onChange={handleChange}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
        <div>
          <Label htmlFor="insurance_amount">Insurance Amount</Label>
          <Input
            id="insurance_amount"
            name="insurance_amount"
            type="number"
            value={formData.insurance_amount}
            onChange={(e) => setFormData({...formData, insurance_amount: e.target.value})}
            className="bg-white border-gray-300 text-gray-900"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="license_number">License Number</Label>
        <Input
          id="license_number"
          name="license_number"
          value={formData.license_number}
          onChange={handleChange}
          className="bg-white border-gray-300 text-gray-900"
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          className="bg-white border-gray-300 text-gray-900"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-gray-300 text-gray-700 hover:bg-gray-100"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Add Company')}
        </Button>
      </div>
    </form>
  );
}


export default function Companies() {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [companyToDelete, setCompanyToDelete] = React.useState(null);
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Company.create(data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowAddModal(false);
      setEditingCompany(null);
    },
    onError: (error) => {
      console.error('Error creating company:', error);
      alert('Failed to create company. Please try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Company.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowAddModal(false);
      setEditingCompany(null);
    },
    onError: (error) => {
      console.error('Error updating company:', error);
      alert('Failed to update company. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (companyId) => base44.entities.Company.delete(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowDeleteConfirm(false);
      setCompanyToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting company:', error);
      alert('Failed to delete company. Please try again.');
    },
  });

  const handleEdit = (company) => {
    setEditingCompany(company);
    setShowAddModal(true);
  };

  const handleSubmit = (data) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteClick = (e, company) => {
    e.stopPropagation();
    setCompanyToDelete(company);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (companyToDelete) {
      deleteMutation.mutate(companyToDelete.id);
    }
  };
  
  const columns = [
    {
      header: "Name",
      accessorKey: "name",
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-sm text-gray-500">{row.email}</div>
        </div>
      )
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: (row) => <span className="text-gray-900">{row.type}</span>
    },
    {
      header: "Location",
      accessorKey: "city",
      cell: (row) => row.city && row.state ? `${row.city}, ${row.state}` : '-'
    },
    {
      header: "Phone",
      accessorKey: "phone",
      cell: (row) => <span className="text-gray-600">{row.phone || '-'}</span>
    },
    {
      header: "Insurance",
      accessorKey: "insurance_expiry",
      cell: (row) => {
        if (!row.insurance_expiry) return '-';
        const expiry = new Date(row.insurance_expiry);
        const today = new Date();
        const daysUntilExpiry = differenceInDays(expiry, today);
        const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
        const isExpired = daysUntilExpiry < 0;

        return (
          <span className={`${isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-orange-500 font-medium' : 'text-gray-900'}`}>
            {format(expiry, 'MMM d, yyyy')}
            {isExpired && ' (Expired)'}
            {isExpiringSoon && ' (Expiring Soon)'}
          </span>
        );
      }
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
              handleEdit(row);
            }}
            className="text-gray-600 hover:text-[#1B4D3E]"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => handleDeleteClick(e, row)}
            className="text-gray-600 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Companies & Vendors</h2>
        <p className="text-gray-600 mt-1">Manage clients, subcontractors, and suppliers</p>
      </div>

      <DataTable
        columns={columns}
        data={companies}
        isLoading={isLoading}
        onRowClick={handleEdit}
        onCreateNew={() => { setEditingCompany(null); setShowAddModal(true); }}
        emptyMessage="No companies yet. Create your first company."
        searchPlaceholder="Search companies by name, email, city..."
        statusFilter={{
          field: 'type',
          options: ['Owner', 'GC', 'Subcontractor', 'Supplier', 'Consultant']
        }}
      />

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Edit Company' : 'Add New Company'}</DialogTitle>
          </DialogHeader>
          <AddEditCompanyForm
            initialData={editingCompany}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowAddModal(false);
              setEditingCompany(null);
            }}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            isEditing={!!editingCompany}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900">
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{companyToDelete?.name}</span>?
            </p>
            <p className="text-sm text-red-600">
              Warning: This action cannot be undone. Any projects, bills, or invoices associated with this company will lose their company reference.
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
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Company'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}