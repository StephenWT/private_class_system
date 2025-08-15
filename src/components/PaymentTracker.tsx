import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Receipt, CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Invoice {
  id: string;
  invoice_number: string;
  student_name: string;
  total_amount: number;
  status: string;
  due_date: string;
  invoice_date: string;
  student_id: string;
}

const PaymentTracker = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const user = await supabase.auth.getUser();
      const teacherId = user.data.user?.id;

      if (!teacherId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total_amount,
          status,
          due_date,
          invoice_date,
          student_id,
          students!inner(student_name)
        `)
        .eq('teacher_id', teacherId)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const formattedInvoices = data?.map(invoice => ({
        ...invoice,
        student_name: (invoice.students as any).student_name
      })) || [];

      setInvoices(formattedInvoices);
    } catch (error) {
      toast({
        title: "Error loading invoices",
        description: error instanceof Error ? error.message : "Failed to load invoices",
        variant: "destructive",
      });
    }
  };

  const processPayment = async () => {
    if (!selectedInvoice) return;

    setIsProcessing(true);
    try {
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: selectedInvoice.id,
          student_id: selectedInvoice.student_id,
          amount: amount,
          payment_method: paymentMethod,
          payment_reference: `PAY-${Date.now()}`, // Temporary reference, should use DB function
          notes: paymentNotes
        });

      if (paymentError) throw paymentError;

      // Update invoice status to paid if full amount is paid
      const newStatus = amount >= selectedInvoice.total_amount ? 'paid' : 'partial';
      
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', selectedInvoice.id);

      if (invoiceError) throw invoiceError;

      // Update student payment status
      const { error: studentError } = await supabase
        .from('students')
        .update({ 
          payment_status: newStatus === 'paid' ? 'paid' : 'pending',
          last_payment_date: new Date().toISOString().split('T')[0],
          invoice_amount: selectedInvoice.total_amount
        })
        .eq('id', selectedInvoice.student_id);

      if (studentError) throw studentError;

      toast({
        title: "Payment processed",
        description: `Payment of $${amount.toFixed(2)} recorded successfully`,
      });

      // Reset form and reload data
      setIsDialogOpen(false);
      setSelectedInvoice(null);
      setPaymentAmount('');
      setPaymentNotes('');
      loadInvoices();

    } catch (error) {
      toast({
        title: "Error processing payment",
        description: error instanceof Error ? error.message : "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReceipt = (invoice: Invoice) => {
    // Simple receipt generation - in a real app, you'd want proper PDF generation
    const receiptContent = `
PAYMENT RECEIPT

Invoice: ${invoice.invoice_number}
Student: ${invoice.student_name}
Amount: $${invoice.total_amount.toFixed(2)}
Date: ${new Date().toLocaleDateString()}
Status: ${invoice.status.toUpperCase()}

Thank you for your payment!
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${invoice.invoice_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Receipt generated",
      description: "Receipt has been downloaded",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'partial':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'partial':
        return 'secondary';
      default:
        return 'destructive';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <CardTitle>Payment Tracking</CardTitle>
          </div>
          <CardDescription>
            Track payments and generate receipts for invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No invoices found</p>
                <p className="text-sm">Generate some invoices first to track payments</p>
              </div>
            ) : (
              invoices.map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(invoice.status)}
                      <span className="font-medium">{invoice.invoice_number}</span>
                      <Badge variant={getStatusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {invoice.student_name} • ${invoice.total_amount.toFixed(2)} • Due: {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    {invoice.status !== 'paid' && (
                      <Dialog open={isDialogOpen && selectedInvoice?.id === invoice.id} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (open) {
                          setSelectedInvoice(invoice);
                          setPaymentAmount(invoice.total_amount.toString());
                        } else {
                          setSelectedInvoice(null);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <DollarSign className="w-4 h-4 mr-1" />
                            Record Payment
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record Payment</DialogTitle>
                            <DialogDescription>
                              Record a payment for invoice {invoice.invoice_number}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Payment Amount</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Payment Method</Label>
                              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="check">Check</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Notes (Optional)</Label>
                              <Input
                                placeholder="Payment notes..."
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                              />
                            </div>
                            
                            <Button 
                              onClick={processPayment} 
                              disabled={isProcessing}
                              className="w-full"
                            >
                              {isProcessing ? 'Processing...' : 'Record Payment'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    
                    {invoice.status === 'paid' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => generateReceipt(invoice)}
                      >
                        <Receipt className="w-4 h-4 mr-1" />
                        Receipt
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentTracker;