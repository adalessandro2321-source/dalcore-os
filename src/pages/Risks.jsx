
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  AlertTriangle,
  TrendingUp,
  Shield,
  Edit,
  Trash2,
  CheckCircle2,
  Filter,
  Clock,
  Eye
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate, formatDateTime } from "../components/shared/DateFormatter";
import AIRiskAnalysis from "../components/risk/AIRiskAnalysis";

const RISK_MATRIX_COLORS = {
  'Low-Low': 'bg-green-100 text-green-800 border-green-300',
  'Low-Medium': 'bg-green-100 text-green-800 border-green-300',
  'Low-High': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Medium-Low': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Medium-Medium': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Medium-High': 'bg-orange-100 text-orange-800 border-orange-300',
  'High-Low': 'bg-orange-100 text-orange-800 border-orange-300',
  'High-Medium': 'bg-red-100 text-red-800 border-red-300',
  'High-High': 'bg-red-100 text-red-800 border-red-300',
};

const REVIEW_THRESHOLD_DAYS = 30;

export default function RisksPage() {
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);
  const [viewingRisk, setViewingRisk] = React.useState(null);
  const [editingRisk, setEditingRisk] = React.useState(null);
  const [deletingRisk, setDeletingRisk] = React.useState(null);
  const [filterCategory, setFilterCategory] = React.useState('all');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterProject, setFilterProject] = React.useState('all');
  const [filterOwner, setFilterOwner] = React.useState('all');
  const [filterImpact, setFilterImpact] = React.useState('all');
  const [filterProbability, setFilterProbability] = React.useState('all');
  const [sortBy, setSortBy] = React.useState('score'); // 'score', 'date', 'title'
  const [sortDirection, setSortDirection] = React.useState('desc');
  const [formData, setFormData] = React.useState({
    title: '',
    project_id: '',
    category: 'Safety',
    probability: 'Medium',
    impact: 'Medium',
    description: '',
    mitigation_plan: '',
    status: 'Identified',
    owner: '',
    source: 'Manual',
    daily_log_id: ''
  });
  const queryClient = useQueryClient();

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ['risks'],
    queryFn: () => base44.entities.Risk.list('-created_date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['dailyLogs'],
    queryFn: () => base44.entities.DailyLog.list('-log_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Risk.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      setShowCreateModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Risk.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      setShowEditModal(false);
      setEditingRisk(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Risk.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      setShowDeleteDialog(false);
      setDeletingRisk(null);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      project_id: '',
      category: 'Safety',
      probability: 'Medium',
      impact: 'Medium',
      description: '',
      mitigation_plan: '',
      status: 'Identified',
      owner: '',
      source: 'Manual',
      daily_log_id: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData };
    
    // Set last_review_date if status is Monitoring
    if (submitData.status === 'Monitoring') {
      submitData.last_review_date = new Date().toISOString();
    }
    
    createMutation.mutate(submitData);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData };
    
    // If changing status to Monitoring and no last_review_date, set it
    if (submitData.status === 'Monitoring' && !editingRisk.last_review_date) {
      submitData.last_review_date = new Date().toISOString();
    }
    
    updateMutation.mutate({ id: editingRisk.id, data: submitData });
  };

  const handleEdit = (risk) => {
    setEditingRisk(risk);
    setFormData({
      title: risk.title,
      project_id: risk.project_id,
      category: risk.category,
      probability: risk.probability,
      impact: risk.impact,
      description: risk.description || '',
      mitigation_plan: risk.mitigation_plan || '',
      status: risk.status,
      owner: risk.owner || '',
      source: risk.source || 'Manual',
      daily_log_id: risk.daily_log_id || ''
    });
    setShowEditModal(true);
  };

  const handleResolve = (risk) => {
    updateMutation.mutate({
      id: risk.id,
      data: { 
        status: 'Mitigated',
        mitigation_complete_date: new Date().toISOString(),
        mitigation_complete_by: currentUser?.email || ''
      }
    });
  };

  const handleMarkReviewed = (risk) => {
    updateMutation.mutate({
      id: risk.id,
      data: { 
        last_review_date: new Date().toISOString()
      }
    });
  };

  const handleDelete = (risk) => {
    setDeletingRisk(risk);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deletingRisk) {
      deleteMutation.mutate(deletingRisk.id);
    }
  };

  const handleViewDetails = (risk) => {
    setViewingRisk(risk);
    setShowDetailsModal(true);
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  const getRiskScore = (probability, impact) => {
    const scoreMap = { 'Low': 1, 'Medium': 2, 'High': 3 };
    return scoreMap[probability] * scoreMap[impact];
  };

  const getRiskColor = (probability, impact) => {
    return RISK_MATRIX_COLORS[`${probability}-${impact}`] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getDailyLogInfo = (risk) => {
    if (!risk.daily_log_id || risk.source === 'Manual') return null;
    const logIdPrefix = risk.daily_log_id.split('-')[0];
    const log = dailyLogs.find(l => l.id === logIdPrefix);
    if (!log) return null;
    return {
      date: log.log_date,
      project: log.project_id
    };
  };

  const needsReview = (risk) => {
    if (risk.status !== 'Monitoring') return false;
    if (!risk.last_review_date) return true;
    
    const lastReview = new Date(risk.last_review_date);
    const daysSinceReview = Math.floor((new Date() - lastReview) / (1000 * 60 * 60 * 24));
    return daysSinceReview >= REVIEW_THRESHOLD_DAYS;
  };

  // Apply filters
  let filteredRisks = risks.filter(risk => {
    if (filterCategory !== 'all' && risk.category !== filterCategory) return false;
    if (filterStatus !== 'all' && risk.status !== filterStatus) return false;
    if (filterProject !== 'all' && risk.project_id !== filterProject) return false;
    if (filterOwner !== 'all' && risk.owner !== filterOwner) return false;
    if (filterImpact !== 'all' && risk.impact !== filterImpact) return false;
    if (filterProbability !== 'all' && risk.probability !== filterProbability) return false;
    return true;
  });

  // Apply sorting
  filteredRisks = [...filteredRisks].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'score') {
      const scoreA = getRiskScore(a.probability, a.impact);
      const scoreB = getRiskScore(b.probability, b.impact);
      comparison = scoreB - scoreA;
    } else if (sortBy === 'date') {
      comparison = new Date(b.created_date) - new Date(a.created_date);
    } else if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title);
    }
    
    return sortDirection === 'desc' ? comparison : -comparison;
  });

  // Calculate summary stats
  const activeRisks = filteredRisks.filter(r => ['Identified', 'Monitoring'].includes(r.status));
  const highRisks = filteredRisks.filter(r => getRiskScore(r.probability, r.impact) >= 6);
  const mitigatedRisks = filteredRisks.filter(r => r.status === 'Mitigated');
  const needsReviewCount = filteredRisks.filter(r => needsReview(r)).length;

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'user';
  const canDelete = currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Risk Register</h2>
          <p className="text-gray-600 mt-1">Track and mitigate project risks</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Risk
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Risks</p>
                <p className="text-3xl font-bold text-gray-900">{activeRisks.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">High Priority</p>
                <p className="text-3xl font-bold text-red-600">{highRisks.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Mitigated</p>
                <p className="text-3xl font-bold text-[#2A6B5A]">{mitigatedRisks.length}</p>
              </div>
              <Shield className="w-8 h-8 text-[#2A6B5A]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F5F4F3] border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Needs Review</p>
                <p className="text-3xl font-bold text-orange-600">{needsReviewCount}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Risk Analysis Section */}
      <AIRiskAnalysis />

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Automated Risk Detection & Review Tracking
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Risks are automatically suggested from Daily Log entries. Risks in "Monitoring" status will be flagged if not reviewed within {REVIEW_THRESHOLD_DAYS} days.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Sorting */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-48 bg-white border-gray-300">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-white border-gray-300">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Identified">Identified</SelectItem>
            <SelectItem value="Monitoring">Monitoring</SelectItem>
            <SelectItem value="Mitigated">Mitigated</SelectItem>
            <SelectItem value="Occurred">Occurred</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 bg-white border-gray-300">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Safety">Safety</SelectItem>
            <SelectItem value="Schedule">Schedule</SelectItem>
            <SelectItem value="Cost">Cost</SelectItem>
            <SelectItem value="Quality">Quality</SelectItem>
            <SelectItem value="Legal">Legal</SelectItem>
            <SelectItem value="Environmental">Environmental</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterImpact} onValueChange={setFilterImpact}>
          <SelectTrigger className="w-32 bg-white border-gray-300">
            <SelectValue placeholder="Impact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Impact</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterProbability} onValueChange={setFilterProbability}>
          <SelectTrigger className="w-36 bg-white border-gray-300">
            <SelectValue placeholder="Probability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Probability</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-40 bg-white border-gray-300">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {users.map(user => (
              <SelectItem key={user.email} value={user.email}>
                {user.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-32 bg-white border-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Risk Score</SelectItem>
              <SelectItem value="date">Date Created</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
            className="border-gray-300"
          >
            {sortDirection === 'desc' ? '↓' : '↑'}
          </Button>
        </div>
      </div>

      {/* Risks Table */}
      <Card className="bg-[#F5F4F3] border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">Loading risks...</p>
            </div>
          ) : filteredRisks.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-gray-500 mb-3" />
              <p className="text-gray-600 mb-4">No risks found matching your filters.</p>
              <Button
                onClick={() => {
                  setFilterCategory('all');
                  setFilterStatus('all');
                  setFilterProject('all');
                  setFilterOwner('all');
                  setFilterImpact('all');
                  setFilterProbability('all');
                }}
                variant="outline"
                className="border-gray-300 text-gray-700"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-200 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Risk</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Category</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Owner</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRisks.map((risk) => {
                    const riskScore = getRiskScore(risk.probability, risk.impact);
                    const riskColor = getRiskColor(risk.probability, risk.impact);
                    const needsReviewFlag = needsReview(risk);

                    return (
                      <tr key={risk.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{risk.title}</p>
                              {needsReviewFlag && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 border border-orange-300 rounded text-xs text-orange-800">
                                  <Clock className="w-3 h-3" />
                                  <span>Review Needed</span>
                                </div>
                              )}
                            </div>
                            {risk.description && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{risk.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {getProjectName(risk.project_id)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {risk.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 ${riskColor}`}>
                              {riskScore}
                            </span>
                            <span className="text-xs text-gray-600">
                              {risk.probability[0]}/{risk.impact[0]}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            risk.status === 'Mitigated' ? 'bg-green-100 text-green-800' :
                            risk.status === 'Occurred' ? 'bg-red-100 text-red-800' :
                            risk.status === 'Closed' ? 'bg-gray-100 text-gray-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {risk.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {risk.owner ? getUserName(risk.owner) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(risk)}
                              className="text-gray-600 hover:text-[#1B4D3E] h-8"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canEdit && risk.status === 'Monitoring' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkReviewed(risk)}
                                className="text-blue-600 hover:text-blue-700 h-8"
                                title="Mark as Reviewed"
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                            )}
                            {canEdit && risk.status !== 'Mitigated' && risk.status !== 'Closed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResolve(risk)}
                                className="text-[#2A6B5A] hover:text-[#1B4D3E] h-8"
                                title="Mark as Mitigated"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(risk)}
                                className="text-gray-600 hover:text-[#1B4D3E] h-8"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(risk)}
                                className="text-gray-600 hover:text-red-600 h-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Risk</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Risk Title</Label>
              <Input
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                placeholder="e.g., Potential weather delays"
              />
            </div>

            <div>
              <Label>Project</Label>
              <Select
                required
                value={formData.project_id}
                onValueChange={(value) => setFormData({...formData, project_id: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({...formData, category: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Safety">Safety</SelectItem>
                    <SelectItem value="Schedule">Schedule</SelectItem>
                    <SelectItem value="Cost">Cost</SelectItem>
                    <SelectItem value="Quality">Quality</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                    <SelectItem value="Environmental">Environmental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({...formData, status: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Identified">Identified</SelectItem>
                    <SelectItem value="Monitoring">Monitoring</SelectItem>
                    <SelectItem value="Mitigated">Mitigated</SelectItem>
                    <SelectItem value="Occurred">Occurred</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Probability</Label>
                <Select
                  value={formData.probability}
                  onValueChange={(value) => setFormData({...formData, probability: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Impact</Label>
                <Select
                  value={formData.impact}
                  onValueChange={(value) => setFormData({...formData, impact: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
                placeholder="Describe the risk in detail"
              />
            </div>

            <div>
              <Label>Mitigation Plan</Label>
              <Textarea
                value={formData.mitigation_plan}
                onChange={(e) => setFormData({...formData, mitigation_plan: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
                placeholder="How will this risk be addressed or mitigated?"
              />
            </div>

            <div>
              <Label>Risk Owner</Label>
              <Select
                value={formData.owner}
                onValueChange={(value) => setFormData({...formData, owner: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {users.map((user) => (
                    <SelectItem key={user.email} value={user.email}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-300">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Adding...' : 'Add Risk'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Risk</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>Risk Title</Label>
              <Input
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div>
              <Label>Project</Label>
              <Select
                required
                value={formData.project_id}
                onValueChange={(value) => setFormData({...formData, project_id: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({...formData, category: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Safety">Safety</SelectItem>
                    <SelectItem value="Schedule">Schedule</SelectItem>
                    <SelectItem value="Cost">Cost</SelectItem>
                    <SelectItem value="Quality">Quality</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                    <SelectItem value="Environmental">Environmental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({...formData, status: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Identified">Identified</SelectItem>
                    <SelectItem value="Monitoring">Monitoring</SelectItem>
                    <SelectItem value="Mitigated">Mitigated</SelectItem>
                    <SelectItem value="Occurred">Occurred</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Probability</Label>
                <Select
                  value={formData.probability}
                  onValueChange={(value) => setFormData({...formData, probability: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Impact</Label>
                <Select
                  value={formData.impact}
                  onValueChange={(value) => setFormData({...formData, impact: value})}
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
              />
            </div>

            <div>
              <Label>Mitigation Plan</Label>
              <Textarea
                value={formData.mitigation_plan}
                onChange={(e) => setFormData({...formData, mitigation_plan: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                rows={3}
              />
            </div>

            <div>
              <Label>Risk Owner</Label>
              <Select
                value={formData.owner}
                onValueChange={(value) => setFormData({...formData, owner: value})}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  {users.map((user) => (
                    <SelectItem key={user.email} value={user.email}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-300">
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
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="bg-[#F5F4F3] border-gray-300 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Risk Details</DialogTitle>
          </DialogHeader>
          {viewingRisk && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-600">Title</Label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{viewingRisk.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Project</Label>
                  <p className="text-gray-900 mt-1">{getProjectName(viewingRisk.project_id)}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Category</Label>
                  <p className="text-gray-900 mt-1">{viewingRisk.category}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-600">Probability</Label>
                  <p className="text-gray-900 mt-1">{viewingRisk.probability}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Impact</Label>
                  <p className="text-gray-900 mt-1">{viewingRisk.impact}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Risk Score</Label>
                  <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold border-2 mt-1 ${getRiskColor(viewingRisk.probability, viewingRisk.impact)}`}>
                    {getRiskScore(viewingRisk.probability, viewingRisk.impact)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Status</Label>
                  <p className="text-gray-900 mt-1">{viewingRisk.status}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Owner</Label>
                  <p className="text-gray-900 mt-1">{viewingRisk.owner ? getUserName(viewingRisk.owner) : 'Unassigned'}</p>
                </div>
              </div>

              {viewingRisk.description && (
                <div>
                  <Label className="text-gray-600">Description</Label>
                  <p className="text-gray-900 mt-1 whitespace-pre-wrap">{viewingRisk.description}</p>
                </div>
              )}

              {viewingRisk.mitigation_plan && (
                <div>
                  <Label className="text-gray-600">Mitigation Plan</Label>
                  <p className="text-gray-900 mt-1 whitespace-pre-wrap">{viewingRisk.mitigation_plan}</p>
                </div>
              )}

              {viewingRisk.status === 'Mitigated' && viewingRisk.mitigation_complete_date && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <Label className="text-green-900">Mitigation Complete</Label>
                  <p className="text-sm text-green-800 mt-1">
                    <span className="font-medium">Date:</span> {formatDateTime(viewingRisk.mitigation_complete_date)}
                  </p>
                  {viewingRisk.mitigation_complete_by && (
                    <p className="text-sm text-green-800">
                      <span className="font-medium">By:</span> {getUserName(viewingRisk.mitigation_complete_by)}
                    </p>
                  )}
                </div>
              )}

              {viewingRisk.status === 'Monitoring' && (
                <div className={`border rounded-lg p-4 ${needsReview(viewingRisk) ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                  <Label className={needsReview(viewingRisk) ? 'text-orange-900' : 'text-blue-900'}>
                    {needsReview(viewingRisk) ? 'Review Needed' : 'Monitoring Status'}
                  </Label>
                  {viewingRisk.last_review_date ? (
                    <p className={`text-sm mt-1 ${needsReview(viewingRisk) ? 'text-orange-800' : 'text-blue-800'}`}>
                      Last reviewed: {formatDateTime(viewingRisk.last_review_date)}
                    </p>
                  ) : (
                    <p className="text-sm text-orange-800 mt-1">Never reviewed - action needed</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-300">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsModal(false)}
                  className="border-gray-300 text-gray-700"
                >
                  Close
                </Button>
                {canEdit && (
                  <Button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleEdit(viewingRisk);
                    }}
                    className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Risk
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#F5F4F3] border-gray-300">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Risk</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete this risk? This action cannot be undone.
              <br /><br />
              <span className="font-semibold text-gray-900">{deletingRisk?.title}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 text-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
