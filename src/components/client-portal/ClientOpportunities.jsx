import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "../shared/StatusBadge";
import { formatDate, formatCurrency } from "../shared/DateFormatter";
import { TrendingUp, Calendar, DollarSign, Target } from "lucide-react";

export default function ClientOpportunities({ opportunities, company }) {
  if (opportunities.length === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="p-12 text-center">
          <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">No opportunities yet</p>
        </CardContent>
      </Card>
    );
  }

  const activeOpportunities = opportunities.filter(o => 
    !['Lost', 'Under Contract', 'No Longer Bidding'].includes(o.stage)
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Opportunities</p>
                <p className="text-3xl font-bold text-[#0E351F]">
                  {activeOpportunities.length}
                </p>
              </div>
              <Target className="w-8 h-8 text-[#0E351F]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Pipeline Value</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(
                    activeOpportunities.reduce((sum, o) => sum + (o.estimated_value || 0), 0)
                  )}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Awarded</p>
                <p className="text-3xl font-bold text-green-600">
                  {opportunities.filter(o => o.stage === 'Awarded').length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opportunities List */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle>Your Opportunities</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-200">
            {opportunities.map((opportunity) => (
              <div key={opportunity.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">
                      {opportunity.name}
                    </h3>
                    {opportunity.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {opportunity.description}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={opportunity.stage} />
                </div>

                <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Estimated Value</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(opportunity.estimated_value || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Bid Due Date</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(opportunity.bid_due_date) || 'TBD'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Probability</p>
                    <p className="font-semibold text-gray-900">
                      {opportunity.probability || 0}%
                    </p>
                  </div>
                </div>

                {opportunity.stage === 'Awarded' && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✅ This opportunity has been awarded! A project will be created soon.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}