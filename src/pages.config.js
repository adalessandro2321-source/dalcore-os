import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Opportunities from './pages/Opportunities';
import Estimates from './pages/Estimates';
import Schedule from './pages/Schedule';
import Companies from './pages/Companies';
import Documents from './pages/Documents';
import Photos from './pages/Photos';
import Risks from './pages/Risks';
import ProjectDetail from './pages/ProjectDetail';
import Templates from './pages/Templates';
import CostToComplete from './pages/CostToComplete';
import projectDetail from './pages/Project Detail';
import InvoiceDetail from './pages/InvoiceDetail';
import CreateInvoice from './pages/CreateInvoice';
import BillDetail from './pages/BillDetail';
import CreateBill from './pages/CreateBill';
import ChangeOrders from './pages/ChangeOrders';
import Assistant from './pages/Assistant';
import ChangeOrderDetail from './pages/ChangeOrderDetail';
import OpportunityDetail from './pages/OpportunityDetail';
import CashRegister from './pages/CashRegister';
import ProfitLoss from './pages/ProfitLoss';
import PerformanceObligations from './pages/PerformanceObligations';
import OperatingExpenses from './pages/OperatingExpenses';
import Finance from './pages/Finance';
import BillsInvoices from './pages/BillsInvoices';
import CreateEstimate from './pages/CreateEstimate';
import Home from './pages/Home';
import ClientPortal from './pages/ClientPortal';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Projects": Projects,
    "Opportunities": Opportunities,
    "Estimates": Estimates,
    "Schedule": Schedule,
    "Companies": Companies,
    "Documents": Documents,
    "Photos": Photos,
    "Risks": Risks,
    "ProjectDetail": ProjectDetail,
    "Templates": Templates,
    "CostToComplete": CostToComplete,
    "Project Detail": projectDetail,
    "InvoiceDetail": InvoiceDetail,
    "CreateInvoice": CreateInvoice,
    "BillDetail": BillDetail,
    "CreateBill": CreateBill,
    "ChangeOrders": ChangeOrders,
    "Assistant": Assistant,
    "ChangeOrderDetail": ChangeOrderDetail,
    "OpportunityDetail": OpportunityDetail,
    "CashRegister": CashRegister,
    "ProfitLoss": ProfitLoss,
    "PerformanceObligations": PerformanceObligations,
    "OperatingExpenses": OperatingExpenses,
    "Finance": Finance,
    "BillsInvoices": BillsInvoices,
    "CreateEstimate": CreateEstimate,
    "Home": Home,
    "ClientPortal": ClientPortal,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: Layout,
};