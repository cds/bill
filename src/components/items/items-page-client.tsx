'use client'

import { useState } from 'react'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ItemCard } from '@/components/items/item-card'
import { ItemForm } from '@/components/items/item-form'

export function ItemsPageClient({ items }: { items: any[] }) {
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Items" 
        action={<Button onClick={() => setIsFormOpen(true)}>Add Item</Button>} 
      />
      
      {items.length > 0 && (
        <div className="max-w-sm">
          <Input 
            placeholder="Search items..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState 
          icon={Package} 
          title="No items found" 
          description="Get started by adding your first item." 
          action={<Button onClick={() => setIsFormOpen(true)}>Add Item</Button>} 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-8">
              No items match your search.
            </div>
          )}
        </div>
      )}

      <ItemForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        onSaved={() => {}} 
      />
    </div>
  )
}
