import React, { useState } from 'react';
import Customers from './customers';

/**
 * Expert dashboard → Clients: live customer directory (expert/filterCustomers).
 * Previously this module exported a mock client list, so search never hit the API.
 */
export default function ExpertClientsSearchPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  return (
    <div className="min-h-0 h-full">
      <Customers
        qCustomerId={undefined}
        selectedCustomer={selectedCustomer}
        selectCustomer={setSelectedCustomer}
      />
    </div>
  );
}
