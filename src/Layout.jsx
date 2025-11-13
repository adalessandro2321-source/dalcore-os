import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Briefcase,
  FolderOpen,
  FileText,
  DollarSign,
  Calendar,
  Building2,
  Image,
  AlertTriangle,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  FileStack,
  MessageSquare
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import FloatingWidget from "./components/assistant/FloatingWidget";

const navigationItems = [
  { title: "Dashboard", url: "Dashboard", icon: LayoutDashboard },
  { title: "Opportunities", url: "Opportunities", icon: Briefcase },
  { title: "Projects", url: "Projects", icon: FolderOpen },
  { title: "Estimates", url: "Estimates", icon: FileText },
  { title: "Schedule", url: "Schedule", icon: Calendar },
  { title: "Bills/Invoices", url: "BillsInvoices", icon: DollarSign },
  { title: "Finance", url: "Finance", icon: DollarSign },
  { title: "Companies", url: "Companies", icon: Building2 },
  { title: "Photos", url: "Photos", icon: Image },
  { title: "Risks", url: "Risks", icon: AlertTriangle },
  { title: "Templates", url: "Templates", icon: FileStack },
  { title: "Assistant", url: "Assistant", icon: MessageSquare },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  React.useEffect(() => {
    const down = (e) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  // Check if we're on the Home (landing) page - use currentPageName which is more reliable
  const isHomePage = currentPageName === 'Home';

  // Don't show sidebar/header on the Home landing page
  if (isHomePage) {
    return <div className="min-h-screen">{children}</div>;
  }

  const displayPageName = currentPageName === "ProjectDetail" 
    ? "Project Detail" 
    : (currentPageName || '');

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lexend+Peta:wght@400;500;600;700&display=swap');
        
        @font-face {
          font-family: 'Proxima Nova Fallback';
          src: local('Proxima Nova'), local('Helvetica Neue'), local('Helvetica'), local('Arial');
        }

        :root {
          --dalcore-darkest: #0E351F;
          --dalcore-dark: #3B5B48;
          --dalcore-mid: #5A7765;
          --dalcore-text: #181E18;
          --dalcore-olive: #C9C8AF;
          --dalcore-cream: #E8E7DD;
          --dalcore-gray: #9FA097;
          --dalcore-lightest: #F5F4F3;
          
          --background: #F5F4F3;
          --surface: #FFFFFF;
          --surface-hover: #E8E7DD;
          --border: #C9C8AF;
          --text-primary: #181E18;
          --text-secondary: #5A7765;
          --primary: #0E351F;
          --primary-hover: #3B5B48;
          
          --font-body: -apple-system, BlinkMacSystemFont, 'Proxima Nova', 'Proxima Nova Fallback', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          --font-heading: 'Lexend Peta', sans-serif;
        }

        body {
          font-family: var(--font-body);
          background-color: var(--dalcore-lightest);
        }

        h1, h2, h3, h4, h5, h6, .heading {
          font-family: var(--font-heading);
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: var(--dalcore-gray) var(--dalcore-lightest);
        }

        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        *::-webkit-scrollbar-track {
          background: var(--dalcore-lightest);
        }

        *::-webkit-scrollbar-thumb {
          background: var(--dalcore-gray);
          border-radius: 4px;
        }

        *::-webkit-scrollbar-thumb:hover {
          background: var(--dalcore-mid);
        }
      `}</style>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#C9C8AF] transform transition-transform duration-300 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-[#C9C8AF]">
            <div className="flex items-center gap-3">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f46dde05ec96bd3a391a72/8cbe6f4fe_DALCORE_Icon_Emerald.png" 
                alt="DALCORE" 
                className="w-8 h-8"
              />
              <span className="text-lg font-semibold tracking-wide heading" style={{ color: '#181E18' }}>DALCORE OS</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden hover:text-[#0E351F]"
              style={{ color: '#5A7765' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <div className="space-y-1">
              {navigationItems.map((item) => {
                const isActive = location.pathname === createPageUrl(item.url);
                
                return (
                  <Link
                    key={item.url}
                    to={createPageUrl(item.url)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'text-white shadow-md'
                        : 'hover:bg-[#E8E7DD]'
                    }`}
                    style={isActive ? { backgroundColor: '#0E351F' } : { color: '#5A7765' }}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Section */}
          {user && (
            <div className="p-4 border-t border-[#C9C8AF]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0E351F 0%, #3B5B48 100%)' }}>
                  <span className="text-sm font-semibold text-white">
                    {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#181E18' }}>
                    {user.full_name || 'User'}
                  </p>
                  <p className="text-xs truncate" style={{ color: '#5A7765' }}>{user.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[#E8E7DD]"
                style={{ color: '#5A7765' }}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-[#C9C8AF] flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden hover:text-[#0E351F]"
              style={{ color: '#5A7765' }}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold heading" style={{ color: '#181E18' }}>{displayPageName}</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-[#E8E7DD]"
              style={{ backgroundColor: '#F5F4F3', color: '#5A7765' }}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Search</span>
              <kbd className="hidden sm:inline px-2 py-0.5 text-xs bg-white border rounded" style={{ borderColor: '#C9C8AF' }}>⌘K</kbd>
            </button>
            <button className="p-2 rounded-lg transition-colors hover:bg-[#E8E7DD]" style={{ color: '#5A7765' }}>
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search projects, companies, invoices..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.url}
                onSelect={() => {
                  navigate(createPageUrl(item.url));
                  setOpen(false);
                }}
              >
                <item.icon className="w-4 h-4 mr-2" />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Floating Widget (on all pages except Assistant page) */}
      {currentPageName !== 'Assistant' && <FloatingWidget />}
    </div>
  );
}