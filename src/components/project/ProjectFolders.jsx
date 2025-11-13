
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; 
import { 
  FolderOpen, 
  Upload, 
  FileText, 
  ArrowLeft,
  Download,
  Trash2,
  Sparkles,
  Edit,
  ExternalLink,
  DollarSign,
  Plus, // Added for New Bill/Invoice/CO buttons
  Brain, // New for AI Analysis
  Search as SearchIcon // New for Document Search
} from "lucide-react";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import DocumentViewer from "../shared/DocumentViewer";
import DocumentAIAnalysis from "./DocumentAIAnalysis";
import DocumentSearch from "./DocumentSearch";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SmartDocumentUpload from "./SmartDocumentUpload";
import SmartContractUpload from "./SmartContractUpload";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { recalculateProjectBudget } from "../shared/BudgetRecalculation";
import StatusBadge from "../shared/StatusBadge";

const FOLDERS = [
  "Contracts",
  "Correspondences",
  "Drawings & Specs",
  "Estimates",
  "Invoices",
  "Permits",
  "Photos",
  "Proposals",
  "Quotes",
  "Schedules",
  "Change Orders", 
  "Bills", 
  "Payments" 
];

const SMART_FOLDERS = ["Invoices", "Bills", "Change Orders"]; 

export default function ProjectFolders({ projectId }) {
  const navigate = useNavigate();
  const [selectedFolder, setSelectedFolder] = React.useState(null);
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [showSmartUpload, setShowSmartUpload] = React.useState(false);
  const [showSmartContractUpload, setShowSmartContractUpload] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showCreateCOModal, setShowCreateCOModal] = React.useState(false); // Added for Change Order creation
  const [editingDocument, setEditingDocument] = React.useState(null);
  const [uploadData, setUploadData] = React.useState({});
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [coFormData, setCoFormData] = React.useState({ // Added for Change Order form
    status: 'Draft',
    cost_impact: 0,
    schedule_impact_days: 0,
    number: '',
    reason: '',
    description: '',
    requested_by: ''
  });
  const [showAIAnalysis, setShowAIAnalysis] = React.useState(false);
  const [analyzingDocument, setAnalyzingDocument] = React.useState(null);
  const queryClient = useQueryClient();

  // Regular documents query
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => base44.entities.Document.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  // Bills query for Bills folder
  const { data: bills = [] } = useQuery({
    queryKey: ['bills', projectId],
    queryFn: () => base44.entities.Bill.filter({ project_id: projectId }),
    enabled: !!projectId && selectedFolder === 'Bills',
  });

  // Invoices query for Invoices folder
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', projectId],
    queryFn: () => base44.entities.Invoice.filter({ project_id: projectId }),
    enabled: !!projectId && selectedFolder === 'Invoices',
  });

  // Change Orders query for Change Orders folder
  const { data: changeOrders = [] } = useQuery({
    queryKey: ['changeOrders', projectId],
    queryFn: () => base44.entities.ChangeOrder.filter({ project_id: projectId }),
    enabled: !!projectId && selectedFolder === 'Change Orders',
  });

  // Companies for displaying bill vendor names, invoice client names, etc.
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
    enabled: !!projectId && (selectedFolder === 'Bills' || selectedFolder === 'Invoices' || selectedFolder === 'Change Orders'),
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Document.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      setShowEditModal(false);
      setEditingDocument(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId) => base44.entities.Document.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
    },
  });

  const createCOMutation = useMutation({
    mutationFn: async (data) => {
      const co = await base44.entities.ChangeOrder.create({
        ...data,
        project_id: projectId
      });

      if (data.attachments && data.attachments.length > 0) {
        for (const attachment of data.attachments) {
          await base44.entities.Document.create({
            name: `Change Order ${data.number || co.id}`,
            project_id: projectId,
            folder: 'Change Orders',
            type: 'Change Order',
            file_url: attachment,
            linked_entity_type: 'ChangeOrder',
            linked_entity_id: co.id,
            description: `CO ${data.number} - ${formatCurrency(data.cost_impact || 0)}`
          });
        }
      }

      if (data.status === 'Approved') {
        await recalculateProjectBudget(projectId, queryClient);
      }

      return co;
    },
    onSuccess: async () => {
      // More aggressive query invalidation
      await queryClient.invalidateQueries({ queryKey: ['changeOrders'] });
      await queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      await queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      
      // Force refetch to ensure data is fresh
      await queryClient.refetchQueries({ queryKey: ['changeOrders'] });
      await queryClient.refetchQueries({ queryKey: ['changeOrders', projectId] });
      
      setShowCreateCOModal(false);
      setCoFormData({
        status: 'Draft',
        cost_impact: 0,
        schedule_impact_days: 0,
        number: '',
        reason: '',
        description: '',
        requested_by: ''
      });
    }
  });

  const updateCOStatusMutation = useMutation({
    mutationFn: async ({ coId, newStatus }) => {
      const co = changeOrders.find(c => c.id === coId);
      const previousStatus = co?.status;
      
      await base44.entities.ChangeOrder.update(coId, { status: newStatus });
      
      if ((newStatus === 'Approved' && previousStatus !== 'Approved') || 
          (newStatus !== 'Approved' && previousStatus === 'Approved')) {
        await recalculateProjectBudget(projectId, queryClient);
      }
    },
    onSuccess: async () => {
      // More aggressive invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ['changeOrders'] });
      await queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['projectBudgets'] });
      await queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
      
      await queryClient.refetchQueries({ queryKey: ['changeOrders'] });
      await queryClient.refetchQueries({ queryKey: ['changeOrders', projectId] });
    }
  });

  const handleFileUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError(null); // Clear previous errors

    try {
      const file = uploadData.file;
      if (!file) {
        setError('Please select a file to upload.');
        setUploading(false);
        return;
      }

      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      // Validate upload result
      if (!uploadResult || !uploadResult.file_url || typeof uploadResult.file_url !== 'string') {
        throw new Error('Invalid upload response - no file URL received.');
      }

      await base44.entities.Document.create({
        name: uploadData.name || file.name,
        project_id: projectId,
        folder: selectedFolder,
        file_url: uploadResult.file_url,
        type: uploadData.type || 'Other',
        description: uploadData.description,
      });

      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      setShowUploadModal(false);
      setUploadData({});
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload file. Please try again.');
    }
    setUploading(false);
  };

  const handleSmartUploadComplete = () => {
    setShowSmartUpload(false);
    queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
    queryClient.invalidateQueries({ queryKey: ['invoices', projectId] });
    queryClient.invalidateQueries({ queryKey: ['bills', projectId] });
    queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
  };

  const handleEditDocument = (doc) => {
    setEditingDocument({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      description: doc.description,
      linked_entity_type: doc.linked_entity_type,
      linked_entity_id: doc.linked_entity_id
    });
    setShowEditModal(true);
  };

  const handleViewBill = (bill) => {
    navigate(createPageUrl(`BillDetail?id=${bill.id}&returnTo=project&projectId=${projectId}`));
  };

  const handleViewInvoice = (invoice) => {
    navigate(createPageUrl(`InvoiceDetail?id=${invoice.id}&returnTo=project&projectId=${projectId}`));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateDocumentMutation.mutate({
      id: editingDocument.id,
      data: {
        name: editingDocument.name,
        type: editingDocument.type,
        description: editingDocument.description
      }
    });
  };

  const handleSubmitCO = (e) => {
    e.preventDefault();
    createCOMutation.mutate(coFormData);
  };

  const handleCOStatusChange = (co, newStatus) => {
    updateCOStatusMutation.mutate({ coId: co.id, newStatus });
  };

  const handleAnalyzeDocument = (doc) => {
    setAnalyzingDocument(doc);
    setShowAIAnalysis(true);
  };

  const getFolderDocuments = (folder) => {
    return documents.filter(d => d.folder === folder);
  };

  const getFolderCount = (folder) => {
    if (folder === 'Bills') {
      return bills.length;
    } else if (folder === 'Invoices') {
      return invoices.length;
    } else if (folder === 'Change Orders') {
      return changeOrders.length;
    }
    return getFolderDocuments(folder).length;
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Unknown Company';
  };

  const getVendorName = (vendorId) => {
    return getCompanyName(vendorId);
  };

  const getClientName = (clientId) => {
    return getCompanyName(clientId);
  };

  const isSmartFolder = (folder) => SMART_FOLDERS.includes(folder);

  return (
    <>
      {selectedFolder ? (
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardHeader className="border-b border-gray-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFolder(null)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <CardTitle className="text-xl">{selectedFolder}</CardTitle>
              </div>
              <div className="flex gap-2"> 
                {selectedFolder === 'Contracts' && (
                  <Button
                    onClick={() => setShowSmartContractUpload(true)}
                    className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Smart Contract Upload
                  </Button>
                )}
                {isSmartFolder(selectedFolder) && selectedFolder !== 'Contracts' && (
                  <Button
                    onClick={() => setShowSmartUpload(true)}
                    className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Smart Upload
                  </Button>
                )}
                {!isSmartFolder(selectedFolder) && selectedFolder !== 'Contracts' && (
                  <Button
                    onClick={() => { setShowUploadModal(true); setError(null); }}
                    variant="outline" 
                    className="border-gray-300 text-gray-700" 
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                )}
              </div>
            </div>
            {selectedFolder === 'Contracts' && (
              <p className="text-sm text-gray-600 mt-2">
                💡 Use Smart Contract Upload to automatically extract payment terms and create performance obligations
              </p>
            )}
            {isSmartFolder(selectedFolder) && selectedFolder !== 'Contracts' && (
              <p className="text-sm text-gray-600 mt-2">
                💡 Use Smart Upload to automatically extract data and update your project's Cost-to-Complete
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-300">
              {/* Bills Folder - Show actual Bills */}
              {selectedFolder === 'Bills' && (
                <div className="space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold" style={{ color: '#181E18' }}>Bills</h3>
                    <Link to={createPageUrl('CreateBill', { projectId: projectId })}>
                      <Button size="sm" className="text-white" style={{ backgroundColor: '#0E351F' }}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Bill
                      </Button>
                    </Link>
                  </div>
                  {bills.length === 0 ? (
                    <div className="p-12 text-center">
                      <DollarSign className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                      <p className="text-gray-600 mb-4">No bills for this project yet.</p>
                      <Button
                        onClick={() => setShowSmartUpload(true)}
                        className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Smart Upload Bill
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bills.map((bill) => {
                        const vendorName = getVendorName(bill.vendor_id);
                        return (
                          <div 
                            key={bill.id} 
                            className="p-4 bg-white border border-gray-300 rounded-lg hover:border-[#1B4D3E] transition-colors cursor-pointer"
                            onClick={() => handleViewBill(bill)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <DollarSign className="w-5 h-5 text-orange-600" />
                                  <div>
                                    <p className="font-medium text-gray-900">Bill {bill.number || bill.id.slice(0, 8)}</p>
                                    <p className="text-sm text-gray-600">{vendorName}</p>
                                    {bill.due_date && (
                                      <p className="text-xs text-gray-500 mt-1">Due {formatDate(bill.due_date)}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">{formatCurrency(bill.amount)}</p>
                                <StatusBadge status={bill.status} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Invoices Folder - Show actual Invoices */}
              {selectedFolder === 'Invoices' && (
                <div className="space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold" style={{ color: '#181E18' }}>Invoices</h3>
                    <Link to={createPageUrl('CreateInvoice', { projectId: projectId })}>
                      <Button size="sm" className="text-white" style={{ backgroundColor: '#0E351F' }}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Invoice
                      </Button>
                    </Link>
                  </div>
                  {invoices.length === 0 ? (
                    <div className="p-12 text-center">
                      <DollarSign className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                      <p className="text-gray-600 mb-4">No invoices for this project yet.</p>
                      <Button
                        onClick={() => setShowSmartUpload(true)}
                        className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Smart Upload Invoice
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {invoices.map((invoice) => {
                        const clientName = getClientName(invoice.client_id);
                        return (
                          <div 
                            key={invoice.id} 
                            className="p-4 bg-white border border-gray-300 rounded-lg hover:border-[#1B4D3E] transition-colors cursor-pointer"
                            onClick={() => handleViewInvoice(invoice)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <DollarSign className="w-5 h-5 text-green-600" />
                                  <div>
                                    <p className="font-medium text-gray-900">Invoice {invoice.number || invoice.id.slice(0, 8)}</p>
                                    <p className="text-sm text-gray-600">{clientName}</p>
                                    {invoice.due_date && (
                                      <p className="text-xs text-gray-500 mt-1">Due {formatDate(invoice.due_date)}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">{formatCurrency(invoice.total)}</p>
                                <StatusBadge status={invoice.status} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Change Orders Folder - Show actual Change Orders */}
              {selectedFolder === 'Change Orders' && (
                <div className="space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold" style={{ color: '#181E18' }}>Change Orders</h3>
                    <Button 
                      onClick={() => setShowCreateCOModal(true)}
                      size="sm" 
                      className="text-white" 
                      style={{ backgroundColor: '#0E351F' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Change Order
                    </Button>
                  </div>
                  {changeOrders.length === 0 ? (
                    <div className="p-12 text-center">
                      <FileText className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                      <p className="text-gray-600 mb-4">No change orders for this project yet.</p>
                      <Button
                        onClick={() => setShowCreateCOModal(true)}
                        className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Change Order
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {changeOrders.map((co) => (
                        <div key={co.id} className="p-4 bg-white border border-gray-300 rounded-lg hover:border-[#1B4D3E] transition-colors">
                          <div className="flex items-start justify-between">
                            <Link 
                              to={createPageUrl(`ChangeOrderDetail?id=${co.id}&returnTo=project&projectId=${projectId}`)}
                              className="flex-1"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-gray-400" />
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {co.number || `CO-${co.id?.slice(0, 8)}`}
                                  </p>
                                  <p className="text-sm text-gray-600">{co.reason || 'No reason specified'}</p>
                                  {co.description && (
                                    <p className="text-xs text-gray-500 mt-1">{co.description}</p>
                                  )}
                                </div>
                              </div>
                            </Link>
                            <div className="text-right flex flex-col gap-2">
                              <p className="font-semibold text-gray-900">{formatCurrency(co.cost_impact || 0)}</p>
                              <Select
                                value={co.status}
                                onValueChange={(value) => handleCOStatusChange(co, value)}
                                onClick={(e) => e.stopPropagation()} // Prevent link navigation when clicking select
                              >
                                <SelectTrigger className="w-32 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Draft">Draft</SelectItem>
                                  <SelectItem value="Pending">Pending</SelectItem>
                                  <SelectItem value="Approved">Approved</SelectItem>
                                  <SelectItem value="Completed">Completed</SelectItem>
                                  <SelectItem value="Rejected">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Other Folders - Show Documents */}
              {!isSmartFolder(selectedFolder) && (
                <>
                  {getFolderDocuments(selectedFolder).length === 0 ? (
                    <div className="p-12 text-center">
                      <FileText className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                      <p className="text-gray-600 mb-4">No documents in this folder yet.</p>
                      <Button
                        onClick={() => { setShowUploadModal(true); setError(null); }}
                        variant="outline"
                        className="border-gray-300 text-gray-700"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Document
                      </Button>
                    </div>
                  ) : (
                    getFolderDocuments(selectedFolder).map((doc) => (
                      <div key={doc.id} id={`doc-${doc.id}`} className="p-4 hover:bg-[#EBEAE8] transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <FileText className="w-5 h-5 text-blue-600 mt-1" />
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{doc.name}</h4>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                <span>{doc.type}</span>
                                <span>•</span>
                                <span>v{doc.version}</span>
                                <span>•</span>
                                <span>{formatDate(doc.created_date)}</span>
                              </div>
                              {doc.description && (
                                <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                              )}
                              {doc.tags && doc.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {doc.tags.map((tag, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {doc.file_url && doc.file_url !== 'placeholder' && (
                                <div className="mt-3">
                                  <DocumentViewer 
                                    fileUrl={doc.file_url} 
                                    fileName={doc.name}
                                    showDelete={false}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAnalyzeDocument(doc)}
                              className="text-gray-600 hover:text-indigo-600"
                              title="AI Analysis"
                            >
                              <Brain className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditDocument(doc)}
                              className="text-gray-600 hover:text-[#1B4D3E]"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(doc.id)}
                              className="text-gray-600 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="folders" className="space-y-6">
          <TabsList className="bg-[#F5F4F3] border border-gray-200">
            <TabsTrigger value="folders" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
              <FolderOpen className="w-4 h-4 mr-2" />
              Document Folders
            </TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-[#1B4D3E] data-[state=active]:text-white">
              <SearchIcon className="w-4 h-4 mr-2" />
              AI Search
            </TabsTrigger>
          </TabsList>

          <TabsContent value="folders">
            <Card className="bg-[#F5F4F3] border-gray-200">
              <CardHeader className="border-b border-gray-300">
                <CardTitle>Document Folders</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {FOLDERS.map((folder) => {
                    const count = getFolderCount(folder);
                    const isSmart = isSmartFolder(folder) || folder === 'Contracts'; // 'Contracts' is smart but uses a different uploader
                    return (
                      <button
                        key={folder}
                        onClick={() => setSelectedFolder(folder)}
                        className="p-4 bg-white hover:bg-gray-50 border border-gray-300 hover:border-[#1B4D3E]/50 rounded-lg transition-all group relative" 
                      >
                        {isSmart && ( 
                          <div className="absolute top-2 right-2">
                            <Sparkles className="w-4 h-4 text-[#2A6B5A]" />
                          </div>
                        )}
                        <FolderOpen className="w-8 h-8 text-[#2A6B5A] mb-3 mx-auto group-hover:scale-110 transition-transform" />
                        <p className="text-sm font-medium text-gray-900 text-center">{folder}</p>
                        <p className="text-xs text-gray-600 text-center mt-1">
                          {count} {count === 1 ? (folder === 'Bills' ? 'bill' : folder === 'Invoices' ? 'invoice' : folder === 'Change Orders' ? 'change order' : 'document') : (folder === 'Bills' ? 'bills' : folder === 'Invoices' ? 'invoices' : folder === 'Change Orders' ? 'change orders' : 'documents')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search">
            <DocumentSearch 
              projectId={projectId} 
              onDocumentSelect={(doc) => {
                setSelectedFolder(doc.folder);
                setTimeout(() => {
                  const docElement = document.getElementById(`doc-${doc.id}`);
                  if (docElement) {
                    docElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 100);
              }}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Edit Document Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>Document Name</Label>
              <Input
                value={editingDocument?.name || ''}
                onChange={(e) => setEditingDocument({...editingDocument, name: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div>
              <Label>Document Type</Label>
              <Select
                value={editingDocument?.type || ''}
                onValueChange={(value) => setEditingDocument({...editingDocument, type: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="Plan">Plan</SelectItem>
                  <SelectItem value="Specification">Specification</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Change Order">Change Order</SelectItem>
                  <SelectItem value="Report">Report</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={editingDocument?.description || ''}
                onChange={(e) => setEditingDocument({...editingDocument, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={updateDocumentMutation.isPending}
              >
                {updateDocumentMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Smart Upload Modal */}
      <Dialog open={showSmartUpload} onOpenChange={setShowSmartUpload}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#2A6B5A]" />
              Smart Upload - {selectedFolder}
            </DialogTitle>
          </DialogHeader>
          <SmartDocumentUpload
            projectId={projectId}
            folder={selectedFolder}
            onComplete={handleSmartUploadComplete}
            onCancel={() => setShowSmartUpload(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Regular Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Document to {selectedFolder}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div>
              <Label>File</Label>
              <Input
                type="file"
                required
                onChange={(e) => setUploadData({...uploadData, file: e.target.files[0]})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div>
              <Label>Document Name</Label>
              <Input
                value={uploadData.name || ''}
                onChange={(e) => setUploadData({...uploadData, name: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Leave blank to use filename"
              />
            </div>

            <div>
              <Label>Document Type</Label>
              <Select
                value={uploadData.type || ''}
                onValueChange={(value) => setUploadData({...uploadData, type: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="Plan">Plan</SelectItem>
                  <SelectItem value="Specification">Specification</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="RFI">RFI</SelectItem>
                  <SelectItem value="Submittal">Submittal</SelectItem>
                  <SelectItem value="Report">Report</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Input 
                value={uploadData.description || ''}
                onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUploadModal(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Change Order Modal */}
      <Dialog open={showCreateCOModal} onOpenChange={setShowCreateCOModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Change Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitCO} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Change Order Number</Label>
                <Input
                  value={coFormData.number || ''}
                  onChange={(e) => setCoFormData({...coFormData, number: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="CO-001"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={coFormData.status}
                  onValueChange={(value) => setCoFormData({...coFormData, status: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Reason <span className="text-red-600">*</span></Label>
              <Input
                required
                value={coFormData.reason || ''}
                onChange={(e) => setCoFormData({...coFormData, reason: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="e.g., Design change, unforeseen conditions"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={coFormData.description || ''}
                onChange={(e) => setCoFormData({...coFormData, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cost Impact</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={coFormData.cost_impact || ''}
                  onChange={(e) => setCoFormData({...coFormData, cost_impact: parseFloat(e.target.value) || 0})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Schedule Impact (Days)</Label>
                <Input
                  type="number"
                  value={coFormData.schedule_impact_days || ''}
                  onChange={(e) => setCoFormData({...coFormData, schedule_impact_days: parseInt(e.target.value) || 0})}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label>Requested By</Label>
              <Input
                value={coFormData.requested_by || ''}
                onChange={(e) => setCoFormData({...coFormData, requested_by: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="Name or company"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateCOModal(false);
                  setCoFormData({
                    status: 'Draft',
                    cost_impact: 0,
                    schedule_impact_days: 0,
                    number: '',
                    reason: '',
                    description: '',
                    requested_by: ''
                  });
                }}
                className="border-gray-300 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={createCOMutation.isPending}
              >
                {createCOMutation.isPending ? 'Creating...' : 'Create Change Order'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Smart Contract Upload Modal */}
      <Dialog open={showSmartContractUpload} onOpenChange={setShowSmartContractUpload}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#2A6B5A]" />
              Smart Contract Upload
            </DialogTitle>
          </DialogHeader>
          <SmartContractUpload
            projectId={projectId}
            onComplete={() => {
              setShowSmartContractUpload(false);
              queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
              queryClient.invalidateQueries({ queryKey: ['contracts'] });
              queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
              queryClient.invalidateQueries({ queryKey: ['performanceObligations', projectId] });
            }}
            onCancel={() => setShowSmartContractUpload(false)}
          />
        </DialogContent>
      </Dialog>

      {/* AI Analysis Modal */}
      <Dialog open={showAIAnalysis} onOpenChange={setShowAIAnalysis}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              AI Document Analysis: {analyzingDocument?.name}
            </DialogTitle>
          </DialogHeader>
          {analyzingDocument && (
            <DocumentAIAnalysis
              document={analyzingDocument}
              projectId={projectId}
              onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
