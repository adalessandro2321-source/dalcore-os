import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export default function DataTable({ 
  columns, 
  data, 
  onRowClick,
  onCreateNew,
  emptyMessage = "No data available",
  isLoading = false,
  searchPlaceholder = "Search...",
  statusFilter = null, // { options: ['Draft', 'Active', 'Completed'], field: 'status' }
  additionalFilters = [] // Array of additional filter configs
}) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilterValue, setStatusFilterValue] = React.useState('all');
  const [additionalFilterValues, setAdditionalFilterValues] = React.useState({});
  const [sortConfig, setSortConfig] = React.useState({ key: null, direction: null });
  const itemsPerPage = 10;

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilterValue, additionalFilterValues, sortConfig]);

  // Filter data
  const filteredData = React.useMemo(() => {
    if (!data) return [];
    
    let filtered = [...data];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(row => {
        return columns.some(column => {
          const value = row[column.accessorKey];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }

    // Status filter
    if (statusFilter && statusFilterValue !== 'all') {
      filtered = filtered.filter(row => row[statusFilter.field] === statusFilterValue);
    }

    // Additional filters
    Object.keys(additionalFilterValues).forEach(filterKey => {
      const filterValue = additionalFilterValues[filterKey];
      if (filterValue && filterValue !== 'all') {
        filtered = filtered.filter(row => row[filterKey] === filterValue);
      }
    });

    // Sort data
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // Handle numbers
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Handle strings
        const aString = String(aValue).toLowerCase();
        const bString = String(bValue).toLowerCase();
        
        if (aString < bString) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aString > bString) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, statusFilterValue, additionalFilterValues, sortConfig, columns, statusFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const handleSort = (columnKey) => {
    let direction = 'asc';
    if (sortConfig.key === columnKey && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: columnKey, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-4 h-4 ml-2 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-2 text-[#1B4D3E]" />
      : <ArrowDown className="w-4 h-4 ml-2 text-[#1B4D3E]" />;
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-gray-300 text-gray-900"
            />
          </div>
        </div>

        {statusFilter && (
          <Select
            value={statusFilterValue}
            onValueChange={setStatusFilterValue}
          >
            <SelectTrigger className="w-[180px] bg-white border-gray-300 text-gray-900">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              <SelectItem value="all">All Status</SelectItem>
              {statusFilter.options.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {additionalFilters.map((filter) => (
          <Select
            key={filter.field}
            value={additionalFilterValues[filter.field] || 'all'}
            onValueChange={(value) => setAdditionalFilterValues({
              ...additionalFilterValues,
              [filter.field]: value
            })}
          >
            <SelectTrigger className="w-[180px] bg-white border-gray-300 text-gray-900">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              <SelectItem value="all">All {filter.label}</SelectItem>
              {filter.options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        <div className="flex-1 flex justify-end">
          {onCreateNew && (
            <Button 
              onClick={onCreateNew}
              className="bg-[#1B4D3E] hover:bg-[#14503C] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Showing {currentData.length} of {filteredData.length} records
        {filteredData.length !== (data?.length || 0) && ` (filtered from ${data?.length || 0} total)`}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-200 hover:bg-gray-50">
              {columns.map((column, idx) => (
                <TableHead 
                  key={idx} 
                  className="text-gray-700 font-medium"
                >
                  {column.sortable !== false && column.accessorKey ? (
                    <button
                      onClick={() => handleSort(column.accessorKey)}
                      className="flex items-center hover:text-[#1B4D3E] transition-colors"
                    >
                      {column.header}
                      {getSortIcon(column.accessorKey)}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-gray-600">
                  Loading...
                </TableCell>
              </TableRow>
            ) : currentData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-gray-600">
                  {searchTerm || statusFilterValue !== 'all' || Object.keys(additionalFilterValues).length > 0
                    ? 'No results found. Try adjusting your filters.'
                    : emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              currentData.map((row, rowIdx) => (
                <TableRow 
                  key={rowIdx}
                  onClick={() => onRowClick?.(row)}
                  className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {columns.map((column, colIdx) => (
                    <TableCell key={colIdx} className="text-gray-900">
                      {column.cell ? column.cell(row) : row[column.accessorKey]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}