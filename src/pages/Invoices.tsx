import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, DollarSign, Plus } from 'lucide-react';
import Header from '@/components/Header';
import InvoiceGenerator from '@/components/InvoiceGenerator';
import PaymentTracker from '@/components/PaymentTracker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface InvoicesProps {
  onLogout: () => void;
}

const Invoices = ({ onLogout }: InvoicesProps) => {
  const [activeTab, setActiveTab] = useState('generate');
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-background">
      <Header onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Invoices & Payments</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Generate Invoices
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Track Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate">
            <InvoiceGenerator />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentTracker />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Invoices;