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
import Templates from './pages/Templates';
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
    "Templates": Templates,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};