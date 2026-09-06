import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { PrintButton } from "@/components/shared/print-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { startOfMonth, endOfMonth, format } from "date-fns";

export default async function StockReportPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start, end } = await searchParams;

  const today = new Date();
  const defaultStart = format(startOfMonth(today), "yyyy-MM-dd");
  const defaultEnd = format(endOfMonth(today), "yyyy-MM-dd");

  const startDate = start || defaultStart;
  const endDate = end || defaultEnd;

  const supabase = await createClient();

  // Fetch all items and adjustments as instructed
  const { data: items } = await supabase.from("items").select("id, name").order("name");
  const { data: adjustments } = await supabase
    .from("stock_adjustments")
    .select("item_id, type, quantity, date");

  const itemsData = items || [];
  const adjustmentsData = adjustments || [];

  const reportData = itemsData.map((item) => {
    let opening_qty = 0;
    let qty_in = 0;
    let qty_out = 0;

    const itemAdjs = adjustmentsData.filter((a) => a.item_id === item.id);

    itemAdjs.forEach((adj) => {
      const adjDate = adj.date.split("T")[0]; // extract YYYY-MM-DD
      const qty = Number(adj.quantity) || 0;
      const isAdd = ["add", "opening", "purchase"].includes(adj.type);
      const isReduce = ["reduce", "sale"].includes(adj.type);

      if (adjDate < startDate) {
        if (isAdd) opening_qty += qty;
        if (isReduce) opening_qty -= qty;
      } else if (adjDate >= startDate && adjDate <= endDate) {
        if (isAdd) qty_in += qty;
        if (isReduce) qty_out += qty;
      }
    });

    const closing_qty = opening_qty + qty_in - qty_out;

    return {
      ...item,
      opening_qty,
      qty_in,
      qty_out,
      closing_qty,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Detail Report"
        action={<PrintButton />}
      />

      <Card className="print:shadow-none print:border-none">
        <CardHeader className="print:hidden flex flex-row items-center justify-between">
          <CardTitle>Filter</CardTitle>
          <DateRangeFilter />
        </CardHeader>
        <CardContent>
          <div className="rounded-md border print:border-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="text-right">Opening Qty</TableHead>
                  <TableHead className="text-right">Qty In</TableHead>
                  <TableHead className="text-right">Qty Out</TableHead>
                  <TableHead className="text-right">Closing Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.opening_qty}</TableCell>
                    <TableCell className="text-right">{row.qty_in}</TableCell>
                    <TableCell className="text-right">{row.qty_out}</TableCell>
                    <TableCell className="text-right">{row.closing_qty}</TableCell>
                  </TableRow>
                ))}
                {reportData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No items found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
