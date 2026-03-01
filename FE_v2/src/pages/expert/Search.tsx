import { useState, useEffect, useCallback } from "react";
import {
  searchApi,
  type ExpertResult,
  type CustomerResult,
} from "@/api/searchApi";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { Star, MapPin, Users } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type LoadState = "loading" | "success" | "error";
type ActiveTab = "experts" | "customers";

const PAGE_LIMIT = 12;

// ── Sub-components ─────────────────────────────────────────────────────────

function ExpertCard({ expert }: { expert: ExpertResult }) {
  const initials = expert.username.slice(0, 2).toUpperCase();
  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center text-center gap-3">
        <Avatar className="h-16 w-16">
          {expert.image ? (
            <AvatarImage src={expert.image} alt={expert.username} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="w-full">
          <p className="font-semibold truncate">{expert.username}</p>
          {expert.title && (
            <p className="text-sm text-muted-foreground truncate">
              {expert.title}
            </p>
          )}
          <div className="flex items-center justify-center gap-1 mt-1">
            <Star className="h-3 w-3 text-yellow-400" />
            <span className="text-xs">{expert.rating.toFixed(1)}</span>
          </div>
          {(expert.city ?? expert.country) && (
            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {[expert.city, expert.country].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {expert.keywords.slice(0, 3).map((kw) => (
            <Badge key={kw._id} variant="secondary" className="text-xs">
              {kw.name ?? kw._id}
            </Badge>
          ))}
        </div>
        <div className="text-sm font-medium">
          {expert.price.length > 0 ? `${expert.price[0]}/hr` : "Rate TBD"}
        </div>
        <Button variant="outline" size="sm" className="w-full">
          View Profile
        </Button>
      </CardContent>
    </Card>
  );
}

function CustomerCard({ customer }: { customer: CustomerResult }) {
  const initials = customer.username.slice(0, 2).toUpperCase();
  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center text-center gap-3">
        <Avatar className="h-16 w-16">
          {customer.image ? (
            <AvatarImage src={customer.image} alt={customer.username} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="w-full">
          <p className="font-semibold truncate">{customer.username}</p>
          <Badge variant="secondary" className="mt-1">
            Customer
          </Badge>
          {(customer.city ?? customer.country) && (
            <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {[customer.city, customer.country].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" className="w-full">
          View Profile
        </Button>
      </CardContent>
    </Card>
  );
}

function PageControls({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-6">
      <Button
        variant="outline"
        size="sm"
        disabled={page === 1}
        onClick={onPrev}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page === totalPages}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-64" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
      <p>{message}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ExpertSearch() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("experts");

  // Experts state
  const [expertSearch, setExpertSearch] = useState("");
  const [experts, setExperts] = useState<ExpertResult[]>([]);
  const [expertPage, setExpertPage] = useState(1);
  const [expertTotalPages, setExpertTotalPages] = useState(1);
  const [expertLoad, setExpertLoad] = useState<LoadState>("loading");

  // Customers state
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerTotalPages, setCustomerTotalPages] = useState(1);
  const [customerLoad, setCustomerLoad] = useState<LoadState>("loading");

  const fetchExperts = useCallback((search: string, page: number) => {
    searchApi.searchExperts({
      name: search || undefined,
      page,
      limit: PAGE_LIMIT,
    })
      .then((res) => {
        setExperts(res.experts);
        setExpertTotalPages(res.pagination.totalPages);
        setExpertLoad("success");
      })
      .catch(() => {
        setExpertLoad("error");
      });
  }, []);

  const fetchCustomers = useCallback((search: string, page: number) => {
    searchApi.searchCustomers({
      name: search || undefined,
      page,
      limit: PAGE_LIMIT,
    })
      .then((res) => {
        setCustomers(res.customers);
        setCustomerTotalPages(res.pagination.totalPages);
        setCustomerLoad("success");
      })
      .catch(() => {
        setCustomerLoad("error");
      });
  }, []);

  useEffect(() => {
    fetchExperts(expertSearch, expertPage);
  }, [fetchExperts, expertSearch, expertPage]);

  useEffect(() => {
    fetchCustomers(customerSearch, customerPage);
  }, [fetchCustomers, customerSearch, customerPage]);

  const handleExpertSearch = (val: string) => {
    setExpertLoad("loading");
    setExpertSearch(val);
    setExpertPage(1);
  };

  const handleCustomerSearch = (val: string) => {
    setCustomerLoad("loading");
    setCustomerSearch(val);
    setCustomerPage(1);
  };

  const handleTabChange = (val: string) => {
    if (val === "experts" || val === "customers") {
      setActiveTab(val);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discover</h1>
        <p className="text-muted-foreground mt-1">
          Find experts and customers on WisdomLinked
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="experts">Find Experts</TabsTrigger>
          <TabsTrigger value="customers">Find Customers</TabsTrigger>
        </TabsList>

        {/* ── Experts Tab ── */}
        <TabsContent value="experts" className="space-y-4 mt-4">
          <SearchInput
            placeholder="Search experts by name…"
            value={expertSearch}
            onChange={(e) => handleExpertSearch(e.target.value)}
            onClear={() => handleExpertSearch("")}
          />
          {expertLoad === "loading" ? (
            <GridSkeleton />
          ) : expertLoad === "error" ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Failed to load experts.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setExpertLoad("loading"); fetchExperts(expertSearch, expertPage); }}
              >
                Retry
              </Button>
            </div>
          ) : experts.length === 0 ? (
            <EmptyState message="No experts found" />
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {experts.map((expert) => (
                  <ExpertCard key={expert.id} expert={expert} />
                ))}
              </div>
              <PageControls
                page={expertPage}
                totalPages={expertTotalPages}
                onPrev={() => { setExpertLoad("loading"); setExpertPage((p) => p - 1); }}
                onNext={() => { setExpertLoad("loading"); setExpertPage((p) => p + 1); }}
              />
            </>
          )}
        </TabsContent>

        {/* ── Customers Tab ── */}
        <TabsContent value="customers" className="space-y-4 mt-4">
          <SearchInput
            placeholder="Search customers by name…"
            value={customerSearch}
            onChange={(e) => handleCustomerSearch(e.target.value)}
            onClear={() => handleCustomerSearch("")}
          />
          {customerLoad === "loading" ? (
            <GridSkeleton />
          ) : customerLoad === "error" ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Failed to load customers.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setCustomerLoad("loading"); fetchCustomers(customerSearch, customerPage); }}
              >
                Retry
              </Button>
            </div>
          ) : customers.length === 0 ? (
            <EmptyState message="No customers found" />
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {customers.map((customer) => (
                  <CustomerCard key={customer.id} customer={customer} />
                ))}
              </div>
              <PageControls
                page={customerPage}
                totalPages={customerTotalPages}
                onPrev={() => { setCustomerLoad("loading"); setCustomerPage((p) => p - 1); }}
                onNext={() => { setCustomerLoad("loading"); setCustomerPage((p) => p + 1); }}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
