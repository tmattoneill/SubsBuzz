import { useState, useEffect } from "react";
import { useLocation } from 'wouter';
import { Sidebar } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { formatDate } from "@/lib/utils";

export default function History() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [monitoredEmails, setMonitoredEmails] = useState([]);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  // Fetch monitored emails
  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const response = await fetch('/api/monitored-emails');
        if (response.ok) {
          const data = await response.json();
          setMonitoredEmails(data);
        }
      } catch (error) {
        console.error('Error fetching monitored emails:', error);
      }
    };
    
    fetchEmails();
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar 
        monitoredEmails={monitoredEmails} 
        onAddSourceClick={() => setLocation('/settings')} 
      />
      
      <div className="flex-1 p-4 md:p-8">
        <PageHeader 
          title="Digest History" 
          date={date}
        />
        
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Select a date to view past digests</h2>
          <div className="max-w-sm mx-auto">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
          </div>
          
          {date && (
            <div className="mt-6 text-center">
              <p className="mb-3">Selected date: <strong>{formatDate(date)}</strong></p>
              <Button onClick={() => alert('This feature is under development')}>
                View Digest for {formatDate(date)}
              </Button>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="text-center py-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">History Feature Coming Soon</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              We're working on implementing the ability to view and browse through your past digests.
              In the future, you'll be able to access all previously generated email summaries.
            </p>
            <Button variant="outline" onClick={() => setLocation('/')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}