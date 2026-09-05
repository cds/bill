'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { PartyForm } from '@/components/parties/party-form';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Users } from 'lucide-react';
import Link from 'next/link';

export function PartiesPageClient({ parties }: { parties: any[] }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('customers');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filteredParties = parties.filter((party) => {
    const matchesSearch =
      party.name.toLowerCase().includes(search.toLowerCase()) ||
      (party.phone && party.phone.includes(search));
    const matchesTab =
      activeTab === 'customers' ? party.type === 'customer' : party.type === 'supplier';
    return matchesSearch && matchesTab;
  });

  const renderBalance = (balance: number) => {
    if (!balance || balance === 0) return <span className="text-gray-500">₹0</span>;
    if (balance > 0) {
      return (
        <span className="text-green-600 flex items-center font-medium">
          <ArrowUp className="w-4 h-4 mr-1" />
          {formatCurrency(balance)}
        </span>
      );
    }
    return (
      <span className="text-red-600 flex items-center font-medium">
        <ArrowDown className="w-4 h-4 mr-1" />
        {formatCurrency(Math.abs(balance))}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parties"
        action={<Button onClick={() => setIsFormOpen(true)}>Add Party</Button>}
      />

      <PartyForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSaved={() => setIsFormOpen(false)}
      />

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search parties..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="customers" className="mt-4">
          {filteredParties.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Customers Found"
              description={search ? "Try adjusting your search" : "Get started by adding a customer"}
              action={<Button variant="outline" onClick={() => setIsFormOpen(true)}>Add Customer</Button>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredParties.map((party) => (
                <Link href={`/parties/${party.id}`} key={party.id}>
                  <Card className="hover:bg-accent/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{party.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-500 mb-2">{party.phone || 'No phone'}</div>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <span className="text-sm font-medium">Balance</span>
                        {renderBalance(party.balance || 0)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="suppliers" className="mt-4">
          {filteredParties.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Suppliers Found"
              description={search ? "Try adjusting your search" : "Get started by adding a supplier"}
              action={<Button variant="outline" onClick={() => setIsFormOpen(true)}>Add Supplier</Button>}
            />
          ) : (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredParties.map((party) => (
                <Link href={`/parties/${party.id}`} key={party.id}>
                  <Card className="hover:bg-accent/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{party.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-500 mb-2">{party.phone || 'No phone'}</div>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <span className="text-sm font-medium">Balance</span>
                        {renderBalance(party.balance || 0)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
