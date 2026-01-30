/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Assistant from './pages/Assistant';
import BillDetail from './pages/BillDetail';
import BillsInvoices from './pages/BillsInvoices';
import CashRegister from './pages/CashRegister';
import ChangeOrderDetail from './pages/ChangeOrderDetail';
import ChangeOrders from './pages/ChangeOrders';
import ClientPortal from './pages/ClientPortal';
import Companies from './pages/Companies';
import CostToComplete from './pages/CostToComplete';
import CreateBill from './pages/CreateBill';
import CreateEstimate from './pages/CreateEstimate';
import CreateInvoice from './pages/CreateInvoice';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Estimates from './pages/Estimates';
import Finance from './pages/Finance';
import Home from './pages/Home';
import InvoiceDetail from './pages/InvoiceDetail';
import OperatingExpenses from './pages/OperatingExpenses';
import Opportunities from './pages/Opportunities';
import OpportunityDetail from './pages/OpportunityDetail';
import PerformanceObligations from './pages/PerformanceObligations';
import Photos from './pages/Photos';
import ProfitLoss from './pages/ProfitLoss';
import projectDetail from './pages/Project Detail';
import ProjectDetail from './pages/ProjectDetail';
import Projects from './pages/Projects';
import Risks from './pages/Risks';
import Schedule from './pages/Schedule';
import TaxAudit2025 from './pages/TaxAudit2025';
import Templates from './pages/Templates';
import WeeklySchedule from './pages/WeeklySchedule';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Assistant": Assistant,
    "BillDetail": BillDetail,
    "BillsInvoices": BillsInvoices,
    "CashRegister": CashRegister,
    "ChangeOrderDetail": ChangeOrderDetail,
    "ChangeOrders": ChangeOrders,
    "ClientPortal": ClientPortal,
    "Companies": Companies,
    "CostToComplete": CostToComplete,
    "CreateBill": CreateBill,
    "CreateEstimate": CreateEstimate,
    "CreateInvoice": CreateInvoice,
    "Dashboard": Dashboard,
    "Documents": Documents,
    "Estimates": Estimates,
    "Finance": Finance,
    "Home": Home,
    "InvoiceDetail": InvoiceDetail,
    "OperatingExpenses": OperatingExpenses,
    "Opportunities": Opportunities,
    "OpportunityDetail": OpportunityDetail,
    "PerformanceObligations": PerformanceObligations,
    "Photos": Photos,
    "ProfitLoss": ProfitLoss,
    "Project Detail": projectDetail,
    "ProjectDetail": ProjectDetail,
    "Projects": Projects,
    "Risks": Risks,
    "Schedule": Schedule,
    "TaxAudit2025": TaxAudit2025,
    "Templates": Templates,
    "WeeklySchedule": WeeklySchedule,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};