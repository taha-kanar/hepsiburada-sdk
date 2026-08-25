/* eslint-disable */
/**
 * Paging dialect per operation — generated from each document's own query parameters.
 *
 * Keyed `<module>.<operationId>`. Read the table in src/core/pagination.ts for why this is
 * data rather than a convention.
 */
import type { PaginationDescriptor } from '../core/pagination.js';

export const PAGINATION: Record<string, PaginationDescriptor> = {
  "catalog.getCategoriesAttributeValues": {
    "request": {
      "style": "page",
      "pageParam": "page",
      "sizeParam": "size",
      "firstPage": 0
    },
    "response": {
      "items": "items"
    }
  },
  "catalog.getProductsTrackingIdHistory": {
    "request": {
      "style": "page",
      "pageParam": "page",
      "sizeParam": "size",
      "firstPage": 0
    },
    "response": {
      "items": "data"
    }
  },
  "catalog.getProductsStatus": {
    "request": {
      "style": "page",
      "pageParam": "page",
      "sizeParam": "size",
      "firstPage": 0
    },
    "response": {
      "items": "data",
      "total": "totalElements",
      "pageCount": "totalPages"
    }
  },
  "catalog.getProductsProductsByMerchantAndStatus": {
    "request": {
      "style": "page",
      "pageParam": "page",
      "sizeParam": "size",
      "firstPage": 0
    },
    "response": {
      "items": "data",
      "total": "totalElements",
      "pageCount": "totalPages"
    }
  },
  "catalog.getProductsAllProductsOfMerchant": {
    "request": {
      "style": "page",
      "pageParam": "page",
      "sizeParam": "size",
      "firstPage": 0
    },
    "response": {
      "items": "data",
      "total": "totalElements",
      "pageCount": "totalPages"
    }
  },
  "catalog.getCategoriesGetAllCategories": {
    "request": {
      "style": "page",
      "pageParam": "page",
      "sizeParam": "size",
      "firstPage": 0
    },
    "response": {
      "items": "data",
      "total": "totalElements",
      "pageCount": "totalPages"
    }
  },
  "product-update.getIntegratorStatus": {
    "request": {
      "style": "page",
      "pageParam": "page",
      "sizeParam": "size",
      "firstPage": 0
    },
    "response": {
      "items": "data",
      "total": "totalElements",
      "pageCount": "totalPages"
    }
  },
  "listing.getListings": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "listings",
      "total": "totalCount"
    }
  },
  "promotion.getSelfCampaignDiscounts": {
    "request": {
      "style": "page",
      "pageParam": "page",
      "sizeParam": "pagesize",
      "firstPage": 0
    },
    "response": {
      "items": "data"
    }
  },
  "order.getOrders": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items",
      "total": "totalCount",
      "pageCount": "pageCount"
    }
  },
  "order.getOrdersCancelled": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items",
      "total": "totalCount",
      "pageCount": "pageCount"
    }
  },
  "order.getOrdersPaymentawaiting": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items",
      "total": "totalCount",
      "pageCount": "pageCount"
    }
  },
  "order.getPackages": {
    "request": {
      "style": "offset",
      "offsetParam": "Offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items"
    }
  },
  "order.getPackagesDelivered": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items",
      "total": "totalCount",
      "pageCount": "pageCount"
    }
  },
  "order.getPackagesMissingInvoice": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items",
      "total": "totalCount",
      "pageCount": "pageCount"
    }
  },
  "order.getPackagesShipped": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items",
      "total": "totalCount",
      "pageCount": "pageCount"
    }
  },
  "order.getPackagesStatusUnpacked": {
    "request": {
      "style": "offset",
      "offsetParam": "Offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items"
    }
  },
  "order.getPackagesUndelivered": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items",
      "total": "totalCount",
      "pageCount": "pageCount"
    }
  },
  "finance.getTransactions": {
    "request": {
      "style": "offset",
      "offsetParam": "Offset",
      "limitParam": "Limit"
    },
    "response": {
      "items": "items"
    }
  },
  "finance.getOrders": {
    "request": {
      "style": "offset",
      "offsetParam": "Offset",
      "limitParam": "Limit"
    },
    "response": {
      "items": "items",
      "total": "totalCount"
    }
  },
  "question.getIssues": {
    "request": {
      "style": "page",
      "pageParam": "page",
      "sizeParam": "size",
      "firstPage": 1
    },
    "response": {
      "items": "data"
    }
  },
  "claim-list.getClaims": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items"
    }
  },
  "claim-list.getClaimsByStatus": {
    "request": {
      "style": "offset",
      "offsetParam": "offset",
      "limitParam": "limit"
    },
    "response": {
      "items": "items"
    }
  }
};
