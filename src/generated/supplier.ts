/* eslint-disable */
/**
 * Tedarikçi Entegrasyonu — generated from openapi/supplier.json. Do not edit.
 *
 * Source: tedarikci-entegrasyonu v1.0, refreshed with `npm run specs:fetch`.
 * Corrections belong in openapi/overlays/, not here.
 */

export interface AddListingUpdateRequestCommand {
  requestItems?: AddListingUpdateRequestItem[];
}

export interface AddListingUpdateRequestItem {
  /** Teklif yapılan Sku. */
  traceId?: string;
  /** Teklif edilen tedarikçi stok kodu. Zorunlu değildir. */
  merchantSku?: string;
  /** Teklif yapılan Sku. */
  sku?: string;
  /** Teklif edilen fiyat. Zorunlu değildir. */
  price?: number;
  /** Teklif edilen fiyatın geçerli olacağı tarih. Zorunlu değildir. */
  priceEffectiveDate?: string;
  /** Teklif edilen stok. Zorunlu değildir. */
  stock?: number;
  /** Teklif edilen fiyatın para birimi. Fiyat girildiyse zorunludur. Alabileceği değerler (TRY,USD,EUR) */
  currencyCode?: string;
  /** Ürün için teklif edeceğiniz satış durumu bilgisidir. Zorunlu değildir. */
  salable?: boolean;
  /** Ürüne ait koli içi adet bilgisidir. */
  unitPerPackage?: number;
}

export type ApprovalStatus = "Processing" | "Approved" | "Rejected" | "Accepted";

export type CurrencyCode = "None" | "AUD" | "JPY" | "CHF" | "GBP" | "USD" | "TRY" | "EUR";

export interface GetListingUpdateRequestSearchQuery {
  /** Teklif tarihi başlangıcı filtresi. yyyy-MM-dd formatında. Zorunlu değildir. */
  startDate?: string;
  /** Teklif tarihi bitiş filtresi. yyyy-MM-dd formatında. Zorunlu değildir. */
  endDate?: string;
  /** Listelenecek maksimum kayıt adedi. Minimum 0, maksimum 1000 olabilir. Zorunlu değildir */
  limit?: number;
  /**
   * Listelenecek kayıtların başlangıç indeksi. Minimum 0 olabilir. Zorunlu değildir, null gönderildiğinde 0 kullanılır.
   */
  offset?: number;
}

export interface GetSupplierListingsSearchQuery {
  /** Satış türü filtresi. Zorunlu değildir. Alabileceği değerler (Normal, DropShipping, Consignee) */
  listingType?: string;
  /** Ürün durumu filtresi. Zorunlu değildir. Alabileceği değerler (Suspended, Active, Inactive) */
  status?: string;
  /** Fiyat değişiklik tarihi başlangıcı filtresi. 'yyyy-MM-dd' formatında. Zorunlu değildir. */
  lastPurchasePriceUpdateStartDate?: string;
  /** Fiyat değişiklik tarihi bitiş filtresi. 'yyyy-MM-dd' formatında. Zorunlu değildir. */
  lastPurchasePriceUpdateEndDate?: string;
  /**
   * Arama alanı. Sku ya da Tedarikçi stok kodu alanlarında arama yapmak için kullanılabilir. Zorunlu değildir.
   */
  searchText?: string;
  /** Listelenecek maksimum kayıt adedi. Minimum 0, maksimum 1000 olabilir. Zorunlu değildir */
  limit?: number;
  /**
   * Listelenecek kayıtların başlangıç indeksi. Minimum 0 olabilir. Zorunlu değildir, null gönderildiğinde 0 kullanılır.
   */
  offset?: number;
}

export interface GuidIdResult {
  id?: string;
}

export interface GuidIdResultApiResponse {
  data?: GuidIdResult;
  message?: string;
  errorCode?: string;
}

export type ListingStatus = "Suspended" | "Active" | "Inactive";

export type ListingType = "Normal" | "DropShipping" | "Consignee";

export interface ListingUpdateRequestDetailResponse {
  /** Teklif id */
  requestId?: string;
  requestItems?: ListingUpdateRequestItemResponse[];
  /** Teklif tarihi, yyyy-MM-dd formatında */
  createdDateTime?: string;
}

export interface ListingUpdateRequestDetailResponseApiResponse {
  data?: ListingUpdateRequestDetailResponse;
  message?: string;
  errorCode?: string;
}

export interface ListingUpdateRequestItemResponse {
  /** Teklif yapılan Sku */
  sku?: string;
  /** Teklif edilen fiyat */
  price?: number;
  /** Teklif edilen fiyatın geçerlilik tarihi */
  priceEffectiveDate?: string;
  currencyCode?: CurrencyCode;
  /** Teklif edilen stok */
  stock?: number;
  /** Ürüne ait koli içi adet bilgisidir. */
  unitPerPackage?: number;
  priceApprovalStatus?: ApprovalStatus;
  /** Fiyat teklifi red sebebi */
  priceRejectionReason?: string;
  priceEffectiveDateApprovalStatus?: ApprovalStatus;
  /** Fiyat geçerlilik tarihi teklifi red sebebi */
  priceEffectiveDateRejectionReason?: string;
  stockApprovalStatus?: ApprovalStatus;
  /** Stok teklifi red sebebi */
  stockRejectionReason?: string;
  unitPerPackageApprovalStatus?: ApprovalStatus;
  /** Teklif edilen tedarikçi stok kodu */
  merchantSku?: string;
  merchantSkuApprovalStatus?: ApprovalStatus;
  /** Ürün için teklif edeceğiniz satış durumu bilgisidir. */
  salable?: boolean;
  salableApprovalStatus?: ApprovalStatus;
  /** Ürün için teklifinizin red nedenidir. */
  salableRejectionReason?: string;
}

export interface ListingUpdateRequestSearchResponse {
  totalCount?: number;
  rows?: ListingUpdateRequestSummaryResponse[];
}

export interface ListingUpdateRequestSearchResponseApiResponse {
  data?: ListingUpdateRequestSearchResponse;
  message?: string;
  errorCode?: string;
}

export interface ListingUpdateRequestSummaryResponse {
  /** Teklif id */
  requestId?: string;
  /** Teklif tarihi, yyyy-MM-dd formatında */
  createdDateTime?: string;
  /** İşlem kaynağı. Alabileceği değerler (Api, Portal) */
  operationSource?: string;
  /** Teklifteki ürün adedi */
  rowCount?: number;
}

export interface OpenPurchaseOrderResponse {
  totalCount?: number;
  rows?: OpenPurchaseOrderResponseItem[];
}

export interface OpenPurchaseOrderResponseApiResponse {
  data?: OpenPurchaseOrderResponse;
  message?: string;
  errorCode?: string;
}

export interface OpenPurchaseOrderResponseItem {
  /** SAS no */
  purchaseOrderNumber?: string;
  /** Kalem no */
  lineNumber?: number;
  /** Sku */
  sku?: string;
  /** Depo kodu */
  warehouseCode?: string;
  /** Depo Adı */
  warehouseName?: string;
  /** SAS oluşturma tarihi, yyyy-MM-dd formatında */
  createdDate?: string;
  /** SAS kalemindeki ürünlerin depoya teslim edilmesi beklenen son tarihtir. */
  dueDate?: string;
  /** Sevk edilecek maksimum adet */
  remainingQuantity?: number;
  /** Mal giriş adedi */
  receivedQuantity?: number;
  /** Mal çıkış adedi */
  issuedQuantity?: number;
  /** Ürün bilgisi */
  description?: string;
  /** Para birimi. Alabileceği değerler (TRY,USD,EUR) */
  currencyCode?: string;
  /** Birim fiyat */
  purchaseOrderUnitPrice?: number;
  /** Toplam fiyat */
  purchaseOrderTotalPrice?: number;
  /** Ürün tipi */
  definitionName?: string;
  /** Marka */
  brand?: string;
  /** KDV */
  vatRate?: number;
  /** Ürün barkodları */
  barcode?: string[];
  /** Açılan SAS adedi */
  originalLineQuantity?: number;
  /** Sevkiyat oluşturulan adet */
  shipmentListCreatedQuantity?: number;
  /** Kategori id */
  buyingCategoryId?: string;
  /** Kategori adı */
  buyingCategoryName?: string;
  /** Devam eden SAS işlemi olup olmadığının göstergesi */
  inProgressPurchaseOrdersOperation?: boolean;
  operationStatus?: OpenPurchaseOrderResponseStatus;
  /**
   * SAS tipi, Alabileceği değerler (ConsignmentPurchaseOrder, StandardPurchaseOrder, StandardPurchaseOrder)
   */
  purchaseOrderType?: string;
  /** Tedarikçi stok kodu */
  merchantSku?: string;
  /** Depo giriş kapısı bilgisidir. */
  warehouseGateId?: string;
  /** Beklenen tarihin daha önce ertelenip ertelenmediğinin göstergesi */
  isPostdated?: boolean;
  /** Gönderildi olarak işaretlenip işaretlenmediğinin göstergesi */
  isSent?: boolean;
}

export type OpenPurchaseOrderResponseStatus = "Actionable" | "Pending" | "DraftShipment";

export interface OpenPurchaseOrderSearchQuery {
  /** Beklenen tarih başlangıcı filtresi. 'yyyy-MM-dd' formatında. Zorunlu değildir. */
  dueDateStart?: string;
  /** Beklenen tarih bitişi filtresi. 'yyyy-MM-dd' formatında. Zorunlu değildir. */
  dueDateEnd?: string;
  /** SAS oluşturma tarihi başlangıcı filtresi. 'yyyy-MM-dd' formatında. Zorunlu değildir. */
  createdDateStart?: string;
  /** SAS oluşturma tarihi bitişi filtresi. 'yyyy-MM-dd' formatında. Zorunlu değildir. */
  createdDateEnd?: string;
  /** Sku filtresi. Zorunlu değildir. */
  skus?: string[];
  /** Marka filtresi. Zorunlu değildir. */
  brands?: string[];
  /** Kategori filtresi. Zorunlu değildir. */
  buyingCategories?: string[];
  /** Ürün Tipi filtresi. Zorunlu değildir. */
  definitionNames?: string[];
  /**
   * SAS tipi filtresi. Zorunlu değildir. Alabileceği değerler (ConsignmentPurchaseOrder, StandardPurchaseOrder, StandardPurchaseOrder)
   */
  purchaseOrderTypes?: string[];
  /** Depo giriş kapı bilgisidir. Zorunlu değildir. */
  warehouseGateIds?: string[];
  purchaseOrderLines?: PurchaseOrderLine[];
  /** inProgressPurchaseOrdersOperation */
  inProgressPurchaseOrdersOperation?: boolean;
  /** Gönderildi olarak işaretlenip işaretlenmediğinin göstergesi */
  isSent?: boolean;
  searchText?: string;
  sortField?: string;
  sortDirection?: string;
  /** Listelenecek maksimum kayıt adedi. Minimum 0, maksimum 1000 olabilir. Zorunlu değildir */
  limit?: number;
  /**
   * Listelenecek kayıtların başlangıç indeksi. Minimum 0 olabilir. Zorunlu değildir, null gönderildiğinde 0 kullanılır.
   */
  offset?: number;
}

export interface PurchaseOrderLine {
  /** Satın alma sipariş numarasıdır. */
  purchaseOrderNumber?: string;
  /** Satın alma sipariş numarasına ait kalem numarasıdır. */
  lineNumber?: number;
}

export interface SupplierListingItem {
  /** Sku */
  sku?: string;
  /** Tedarikçi stok kodu */
  merchantSku?: string;
  /** Fiyat */
  price?: number;
  /** Para birimi. Alabileceği değerler (TRY, USD, EUR) */
  currencyCode?: string;
  /** Fiyat değişiklik tarihi, yyyy-MM-dd formatında */
  lastPurchasePriceUpdateDate?: string;
  /** Stok */
  stock?: number;
  /** Ürüne ait koli içi adet bilgisidir. */
  unitPerPackage?: number;
  status?: ListingStatus;
  listingType?: ListingType;
}

export interface SupplierListingsResponse {
  totalCount?: number;
  rows?: SupplierListingItem[];
}

export interface SupplierListingsResponseApiResponse {
  data?: SupplierListingsResponse;
  message?: string;
  errorCode?: string;
}

/**
 * Teklif Oluşturma
 *
 * `POST /suppliers/{merchantId}/listingUpdateRequests`
 * Published as "Teklif Oluşturma".
 */
export interface PostSuppliersListingUpdateRequestsParams {
  merchantId: string;
}

export type PostSuppliersListingUpdateRequestsBody = AddListingUpdateRequestCommand;

export type PostSuppliersListingUpdateRequestsResponse = GuidIdResultApiResponse;

/**
 * Teklifleri Listeleme
 *
 * `POST /suppliers/{merchantId}/listingUpdateRequests/search`
 * Published as "Teklifleri Listeleme".
 */
export interface PostSuppliersListingUpdateRequestsSearchParams {
  merchantId: string;
}

export type PostSuppliersListingUpdateRequestsSearchBody = GetListingUpdateRequestSearchQuery;

export type PostSuppliersListingUpdateRequestsSearchResponse = ListingUpdateRequestSearchResponseApiResponse;

/**
 * Teklif Detayı Listeleme
 *
 * `GET /suppliers/{merchantId}/listingUpdateRequests/{requestId}`
 * Published as "Teklif Detayı Listeleme".
 */
export interface GetSuppliersListingUpdateRequestsParams {
  requestId: string;
  merchantId: string;
}

export type GetSuppliersListingUpdateRequestsResponse = ListingUpdateRequestDetailResponseApiResponse;

/**
 * Açık Siparişleri Listeleme
 *
 * `POST /suppliers/{merchantId}/openPurchaseOrders/search`
 * Published as "Açık Siparişleri Listeleme".
 */
export interface PostSuppliersOpenPurchaseOrdersSearchParams {
  merchantId: string;
}

export type PostSuppliersOpenPurchaseOrdersSearchBody = OpenPurchaseOrderSearchQuery;

export type PostSuppliersOpenPurchaseOrdersSearchResponse = OpenPurchaseOrderResponseApiResponse;

/**
 * Envanter Bilgilerini Listeleme
 *
 * `POST /suppliers/{merchantId}/supplierlistings/search`
 * Published as "Envanter Bilgilerini Listeleme".
 */
export interface PostSuppliersSupplierlistingsSearchParams {
  merchantId: string;
}

export type PostSuppliersSupplierlistingsSearchBody = GetSupplierListingsSearchQuery;

export type PostSuppliersSupplierlistingsSearchResponse = SupplierListingsResponseApiResponse;
