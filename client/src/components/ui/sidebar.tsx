import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  History, 
  Star, 
  Settings, 
  Menu, 
  X,
  LogOut
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/AuthContext";

interface SidebarProps {}

export function Sidebar({}: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  const handleSignOut = async () => {
    try {
      await signOut();
      setLocation('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const navItems = [
    { 
      name: "Dashboard", 
      path: "/", 
      icon: <LayoutDashboard className="mr-3 h-4 w-4" /> 
    },
    { 
      name: "History", 
      path: "/history", 
      icon: <History className="mr-3 h-4 w-4" /> 
    },
    { 
      name: "Favorites", 
      path: "/favorites", 
      icon: <Star className="mr-3 h-4 w-4" /> 
    },
    { 
      name: "Settings", 
      path: "/settings", 
      icon: <Settings className="mr-3 h-4 w-4" /> 
    },
  ];

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h1 className="ml-2 text-xl font-semibold text-foreground">SubsBuzz</h1>
        </div>
        {isMobile && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleMobileMenu}
            className="md:hidden text-gray-500"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      <nav>
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <div 
                  className={`flex items-center p-3 rounded-lg ${
                    location === item.path 
                      ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-300" 
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      
      <div className="mt-auto pt-6">
        <div className="flex items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center">
            <span className="text-sm font-medium">
              {user?.displayName ? user.displayName.charAt(0) : 'TO'}
            </span>
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium">
              {user?.displayName || 'Tom O\'Neill'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {user?.email || 'tmattoneill@gmail.com'}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto text-gray-400 hover:text-red-500"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <div className="md:hidden flex justify-between items-center p-4 bg-background border-b border-border">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <h1 className="ml-2 text-xl font-semibold text-foreground">SubsBuzz</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background">
            <div className="p-4">
              {sidebarContent}
            </div>
          </div>
        )}
        
        {/* Hidden sidebar for md and up */}
        <div className="hidden md:block md:w-64 w-full md:min-h-screen p-4 md:p-6 bg-background border-r border-border">
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div className="hidden md:block md:w-64 w-full md:min-h-screen p-4 md:p-6 bg-white border-r border-gray-200">
      {sidebarContent}
    </div>
  );
}
