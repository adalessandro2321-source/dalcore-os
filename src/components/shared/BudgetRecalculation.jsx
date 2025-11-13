import { base44 } from "@/api/base44Client";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function recalculatePerformanceObligationValues(projectId) {
  if (!projectId) return;

  try {
    // Get project and change orders
    const [project, changeOrders, performanceObligations] = await Promise.all([
      base44.entities.Project.list().then(projects => projects.find(p => p.id === projectId)),
      base44.entities.ChangeOrder.filter({ project_id: projectId }),
      base44.entities.PerformanceObligation.list().then(all => all.filter(po => po.project_id === projectId))
    ]);

    if (!project || performanceObligations.length === 0) return;

    // Calculate revised contract value
    const approvedCOs = changeOrders.filter(co => co.status === 'Approved');
    const approved_co_value = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);
    const revisedContractValue = (project.contract_value || 0) + approved_co_value;

    console.log(`=== RECALCULATING PERFORMANCE OBLIGATIONS FOR PROJECT: ${project.name} ===`);
    console.log('Original Contract Value:', project.contract_value);
    console.log('Approved COs Value:', approved_co_value);
    console.log('Revised Contract Value:', revisedContractValue);

    // Update each performance obligation's allocated value based on new contract value
    for (const po of performanceObligations) {
      const newAllocatedValue = (revisedContractValue * po.percentage_of_contract) / 100;
      
      console.log(`Updating ${po.name}: ${po.percentage_of_contract}% = ${newAllocatedValue}`);
      
      await base44.entities.PerformanceObligation.update(po.id, {
        allocated_value: newAllocatedValue
      });
      
      await delay(1000);
    }

    console.log('Performance obligations recalculated successfully');
  } catch (error) {
    console.error('Performance obligation recalculation error:', error);
  }
}

export async function recalculateProjectBudget(projectId, queryClient = null, retryCount = 0) {
  if (!projectId) return;

  try {
    await delay(3000);
    
    const [project, changeOrders, bills, invoices, payments, materialCosts] = await Promise.all([
      base44.entities.Project.list().then(projects => projects.find(p => p.id === projectId)),
      base44.entities.ChangeOrder.filter({ project_id: projectId }),
      base44.entities.Bill.filter({ project_id: projectId }),
      base44.entities.Invoice.filter({ project_id: projectId }),
      base44.entities.Payment.filter({ project_id: projectId }),
      base44.entities.MaterialCost.filter({ project_id: projectId })
    ]);

    console.log(`=== RECALCULATING BUDGET FOR: ${project?.name} ===`);
    console.log('Bills found:', bills.length);
    console.log('Material Costs found:', materialCosts.length);
    console.log('Invoices found:', invoices.length);

    if (!project) return;

    // Recalculate performance obligation values based on new contract value
    await recalculatePerformanceObligationValues(projectId);

    await delay(3000);

    const budgets = await base44.entities.ProjectBudget.filter({ project_id: projectId });
    let existingBudget = null;

    if (budgets.length > 0) {
      const sortedBudgets = budgets.sort((a, b) => {
        const dateA = new Date(a.last_recalculated || a.created_date);
        const dateB = new Date(b.last_recalculated || b.created_date);
        return dateB.getTime() - dateA.getTime();
      });
      
      existingBudget = sortedBudgets[0];

      if (budgets.length > 1) {
        const budgetsToDelete = sortedBudgets.slice(1);
        for (const budget of budgetsToDelete) {
          try {
            await base44.entities.ProjectBudget.delete(budget.id);
            await delay(2000);
          } catch (deleteError) {
            console.error(`Failed to delete duplicate budget ${budget.id}:`, deleteError);
          }
        }
      }
    }

    // Calculate Revised Contract Value
    const approvedCOs = changeOrders.filter(co => co.status === 'Approved');
    const approved_co_value = approvedCOs.reduce((sum, co) => sum + (co.cost_impact || 0), 0);
    const original_contract_value = project.contract_value || 0;
    const revised_contract_value = original_contract_value + approved_co_value;

    // === CALCULATE DETAILED COGS BY CATEGORY ===
    const cogsCategories = [
      'Labor - Field',
      'Labor - Site Supervision',
      'Materials',
      'Subcontractor',
      'Equipment Rental',
      'Permits & Inspections',
      'Waste Disposal',
      'Site Utilities',
      'Job-Specific Insurance',
      'Project Management'
    ];

    // Filter bills that are in COGS categories (all statuses, for committed costs)
    const cogsBills = bills.filter(b => b.category && cogsCategories.includes(b.category));

    console.log('=== MATERIAL COSTS BREAKDOWN ===');
    materialCosts.forEach(mc => {
      console.log(`MaterialCost: ${mc.item} - ${mc.amount} - Approved: ${mc.approved}`);
    });

    // Map MaterialCost categories to COGS categories and calculate totals
    const materialCostsByCategory = {
      labor_field: materialCosts.filter(m => m.item === 'Labor').reduce((sum, m) => sum + (m.amount || 0), 0),
      materials: materialCosts.filter(m => m.item === 'Material').reduce((sum, m) => sum + (m.amount || 0), 0),
      equipment: materialCosts.filter(m => ['Tool', 'Equipment Rental'].includes(m.item)).reduce((sum, m) => sum + (m.amount || 0), 0),
      permits: materialCosts.filter(m => m.item === 'Permit').reduce((sum, m) => sum + (m.amount || 0), 0),
      waste: materialCosts.filter(m => m.item === 'Dump Fee').reduce((sum, m) => sum + (m.amount || 0), 0),
      utilities: materialCosts.filter(m => m.item === 'Fuel').reduce((sum, m) => sum + (m.amount || 0), 0),
      other: materialCosts.filter(m => ['Administration', 'Misc'].includes(m.item)).reduce((sum, m) => sum + (m.amount || 0), 0)
    };

    console.log('Material Costs by Category:', materialCostsByCategory);

    // Calculate COGS by category (Bills + MaterialCosts)
    const cogs_labor_field = cogsBills
      .filter(b => b.category === 'Labor - Field')
      .reduce((sum, b) => sum + (b.amount || 0), 0) + materialCostsByCategory.labor_field;

    const cogs_labor_supervision = cogsBills
      .filter(b => b.category === 'Labor - Site Supervision')
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const cogs_project_management = cogsBills
      .filter(b => b.category === 'Project Management')
      .reduce((sum, b) => sum + (b.amount || 0), 0) + materialCostsByCategory.other;

    const cogs_materials = cogsBills
      .filter(b => b.category === 'Materials')
      .reduce((sum, b) => sum + (b.amount || 0), 0) + materialCostsByCategory.materials;

    const cogs_subcontractors = cogsBills
      .filter(b => b.category === 'Subcontractor')
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const cogs_equipment = cogsBills
      .filter(b => b.category === 'Equipment Rental')
      .reduce((sum, b) => sum + (b.amount || 0), 0) + materialCostsByCategory.equipment;

    const cogs_permits = cogsBills
      .filter(b => b.category === 'Permits & Inspections')
      .reduce((sum, b) => sum + (b.amount || 0), 0) + materialCostsByCategory.permits;

    const cogs_waste = cogsBills
      .filter(b => b.category === 'Waste Disposal')
      .reduce((sum, b) => sum + (b.amount || 0), 0) + materialCostsByCategory.waste;

    const cogs_utilities = cogsBills
      .filter(b => b.category === 'Site Utilities')
      .reduce((sum, b) => sum + (b.amount || 0), 0) + materialCostsByCategory.utilities;

    const cogs_insurance = cogsBills
      .filter(b => b.category === 'Job-Specific Insurance')
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const cogs_total = cogs_labor_field + cogs_labor_supervision + cogs_project_management + 
                      cogs_materials + cogs_subcontractors + cogs_equipment + 
                      cogs_permits + cogs_waste + cogs_utilities + cogs_insurance;

    console.log('=== DETAILED COGS BREAKDOWN ===');
    console.log('Labor - Field (Bills + MaterialCosts):', cogs_labor_field);
    console.log('Labor - Supervision:', cogs_labor_supervision);
    console.log('Project Management (Bills + Admin/Misc MaterialCosts):', cogs_project_management);
    console.log('Materials (Bills + MaterialCosts):', cogs_materials);
    console.log('Subcontractors:', cogs_subcontractors);
    console.log('Equipment (Bills + Tool/Equipment MaterialCosts):', cogs_equipment);
    console.log('Permits (Bills + Permit MaterialCosts):', cogs_permits);
    console.log('Waste (Bills + Dump Fee MaterialCosts):', cogs_waste);
    console.log('Utilities (Bills + Fuel MaterialCosts):', cogs_utilities);
    console.log('Insurance:', cogs_insurance);
    console.log('TOTAL COGS:', cogs_total);

    // Calculate Actual Costs (money already spent/approved)
    const billActualCosts = bills.reduce((sum, bill) => {
      if (bill.status === 'Paid' || bill.status === 'Approved') {
        return sum + (bill.amount || 0);
      } else if (bill.status === 'Partial') {
        const paidAmount = (bill.amount || 0) - (bill.balance_open || 0);
        return sum + paidAmount;
      }
      return sum;
    }, 0);
    
    // Only approved material costs count as "actual"
    const approvedMaterialCosts = materialCosts
      .filter(m => m.approved === true)
      .reduce((sum, m) => sum + (m.amount || 0), 0);
    
    const actual_costs = billActualCosts + approvedMaterialCosts;

    console.log('=== ACTUAL COSTS ===');
    console.log('Bill Actual Costs:', billActualCosts);
    console.log('Approved Material Costs:', approvedMaterialCosts);
    console.log('Total Actual Costs:', actual_costs);

    // Calculate Committed Costs (actual + all pending bills/material costs)
    const totalBillCosts = bills.reduce((sum, bill) => {
      return sum + (bill.amount || 0);
    }, 0);
    
    // All material costs (approved and pending) count as committed
    const totalMaterialCosts = materialCosts.reduce((sum, m) => {
      return sum + (m.amount || 0);
    }, 0);
    
    const committed_costs = totalBillCosts + totalMaterialCosts;

    console.log('=== COMMITTED COSTS ===');
    console.log('Total Bill Costs:', totalBillCosts);
    console.log('Total Material Costs:', totalMaterialCosts);
    console.log('Total Committed Costs:', committed_costs);

    // Calculate AP Open (bills not yet paid)
    const ap_open = bills.reduce((sum, bill) => {
      if (bill.status === 'Approved' || bill.status === 'Pending' || bill.status === 'Draft') {
        return sum + (bill.amount || 0);
      } else if (bill.status === 'Partial') {
        return sum + (bill.balance_open || 0);
      }
      return sum;
    }, 0);

    // Calculate AR Invoiced (all non-draft/void invoices)
    const ar_invoiced = invoices
      .filter(i => !['Draft', 'Void'].includes(i.status))
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    console.log('AR Invoiced:', ar_invoiced);

    // Calculate AR Collected
    const ar_collected = invoices.reduce((sum, inv) => {
      if (['Draft', 'Void'].includes(inv.status)) {
        return sum;
      }
      
      if (!inv.balance_open || inv.balance_open === 0) {
        console.log(`Invoice ${inv.number} fully collected: ${inv.total}`);
        return sum + (inv.total || 0);
      } else {
        const collected = (inv.total || 0) - (inv.balance_open || 0);
        console.log(`Invoice ${inv.number} partially collected: ${collected} of ${inv.total}`);
        return sum + collected;
      }
    }, 0);

    console.log('AR Collected:', ar_collected);

    // Calculate AR Open (outstanding receivables)
    const ar_open = invoices
      .filter(i => !['Draft', 'Void', 'Paid'].includes(i.status))
      .reduce((sum, inv) => {
        if (inv.status === 'Sent') {
          return sum + (inv.total || 0);
        }
        if (inv.status === 'Partial') {
          return sum + (inv.balance_open || 0);
        }
        return sum;
      }, 0);

    console.log('AR Open:', ar_open);

    // Get or calculate uncommitted forecast
    let uncommitted_forecast = existingBudget?.uncommitted_forecast;
    if (uncommitted_forecast === null || uncommitted_forecast === undefined) {
      const estimatedTotalCosts = revised_contract_value * 0.85;
      uncommitted_forecast = Math.max(0, estimatedTotalCosts - committed_costs);
    }

    const forecast_at_completion = committed_costs + uncommitted_forecast;
    const cost_to_complete = forecast_at_completion - actual_costs;
    const percent_complete_cost = forecast_at_completion > 0 ? (actual_costs / forecast_at_completion) * 100 : 0;
    const gp_forecast = revised_contract_value - forecast_at_completion;

    const budgetData = {
      project_id: projectId,
      original_contract_value,
      approved_co_value,
      revised_contract_value,
      committed_costs,
      actual_costs,
      ap_open,
      ar_invoiced,
      ar_collected,
      ar_open,
      cogs_labor_field,
      cogs_labor_supervision,
      cogs_project_management,
      cogs_materials,
      cogs_subcontractors,
      cogs_equipment,
      cogs_permits,
      cogs_waste,
      cogs_utilities,
      cogs_insurance,
      cogs_total,
      uncommitted_forecast,
      forecast_at_completion,
      cost_to_complete,
      percent_complete_cost,
      gp_forecast,
      last_recalculated: new Date().toISOString()
    };

    console.log('=== FINAL BUDGET DATA ===', budgetData);

    if (!existingBudget) {
      await base44.entities.ProjectBudget.create(budgetData);
    } else {
      await base44.entities.ProjectBudget.update(existingBudget.id, budgetData);
    }

    if (queryClient) {
      await queryClient.invalidateQueries({ queryKey: ['projectBudget', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['bills'] });
      await queryClient.invalidateQueries({ queryKey: ['materialCosts'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['performanceObligations'] });
      await queryClient.invalidateQueries({ queryKey: ['performanceObligations', projectId] });
    }
  } catch (error) {
    console.error('Budget recalculation error:', error);
    if (retryCount < 2) {
      console.log(`Retrying recalculation (attempt ${retryCount + 1})...`);
      await delay(5000);
      return recalculateProjectBudget(projectId, queryClient, retryCount + 1);
    }
    throw error;
  }
}