/* eslint-disable */
/**
 * Satıcı Promosyonu Entegrasyonu — generated from openapi/promotion.json. Do not edit.
 *
 * Source: satici-promosyonu-entegrasyonu v1.0, refreshed with `npm run specs:fetch`.
 * Corrections belong in openapi/overlays/, not here.
 */

export interface CreateTLSelfCampaignRequest {
  /** Kampanyanın satıcıya görülecek ismi. */
  name?: string;
  /** Kampanya başlangıç tarihi. */
  startDate?: string;
  /** Kampanya bitiş tarihi. */
  endDate?: string;
  /** Kampanyanın geçerli olacağı kategori idleri. */
  conditionCategories?: string[];
  /** Kampanyanın geçerli olacağı SKU bilgileri. */
  conditionSkus?: string[];
  /** Kampanyanın bütçesi. */
  budget?: number;
  /** Kampanya indirim oranı. */
  discountAmount?: number;
  /** Kampanyanın geçerli olacağı alt limit. */
  conditionAmount?: number;
  /** Kampanyanın müşteri bazında tek kullanımlık olması durumunu belirler. */
  oneTimeUsage?: boolean;
}

export interface CreatePercentSelfCampaignRequest {
  /** Kampanyanın satıcıya görülecek ismi. */
  name?: string;
  /** Kampanya başlangıç tarihi. */
  startDate?: string;
  /** Kampanya bitiş tarihi. */
  endDate?: string;
  /** Kampanyanın uygulanacağı kategori ID listesini belirtir. */
  conditionCategories?: string[];
  /** Kampanyanın uygulanacağı SKU listesini belirtir. */
  conditionSkus?: string[];
  /** Uygulanacak yüzde indirimin değerini belirtir. */
  discountPercentage?: number;
  /** İndirimin geçerli olması için gerekli minimum sepet tutarı. */
  conditionAmount?: number;
  /** Uygulanabilecek maksimum indirim tutarını belirtir. */
  maxDiscountAmount?: number;
  /** Kampanyanın geçerli olacağı maksimum sepet sayısı. */
  maxCartCount?: number;
  /** Kampanyanın müşteri bazında tek kullanımlık olup olmadığını belirtir. */
  oneTimeUsage?: boolean;
}

export interface CreateXYSelfCampaignRequest {
  /** Kampanya için satıcıya gösterilecek isim. */
  name?: string;
  /** Kampanyanın başlangıç tarih ve saatini belirtir. */
  startDate?: string;
  /** Kampanyanın bitiş tarih ve saatini belirtir. */
  endDate?: string;
  /** Kampanyanın geçerli olacağı kategori ID listesini içerir. */
  conditionCategories?: string[];
  /** Kampanyanın geçerli olacağı SKU bilgilerini içerir. */
  conditionSkus?: string[];
  /** Kampanyanın uygulanması için sepet içinde olması gereken ürün adedini belirtir. (X Al Y Öde'deki X) */
  conditionProductCount?: number;
  /** İndirim uygulanabilmesi için müşterinin ödemesi gereken ürün adedini belirtir. (X Al Y Öde'deki Y) */
  mustPayProductCount?: number;
  /** Kampanyanın tekrar edilebilme sayısını belirtir. */
  iterationCount?: number;
  /** Kampanyanın geçerli olacağı maksimum sepet sayısı. */
  maxCartCount?: number;
  /** Kampanyanın müşteri bazında tek seferlik kullanım olup olmadığını belirler. */
  oneTimeUsage?: boolean;
}

export interface CancelSelfCampaignRequest {
  /** İptal edilecek kampanyanın benzersiz ID'sini belirtir. */
  campaignId?: number;
}

/**
 * @remarks Taken from a live response on 2026-08-25, which the published document contradicts. See openapi/overlays/.
 * Returned as {Success, Data:{TotalCount, Items}}. Every property renamed to PascalCase; the camelCase names the document declares are deleted because production never sends them.
 */
export interface SelfCampaignDiscountListResponse {
  /** İşlemin başarılı olup olmadığını belirtir. */
  Success?: boolean;
  /** Toplam kayıt sayısı ve kampanya listesini içerir. */
  Data?: {
  TotalCount?: number;
  Items?: SelfCampaignDiscountListItem[];
};
}

/**
 * @remarks Taken from a live response on 2026-08-25, which the published document contradicts. See openapi/overlays/.
 * Same fields as documented, every one of them PascalCase on the wire.
 */
export interface SelfCampaignDiscountListItem {
  /** Kampanyanın benzersiz kimliği. */
  CampaignId?: number;
  /** Kampanyanın adı. */
  Name?: string;
  /** Kampanyaya ait detaylı açıklama. */
  Description?: string;
  /** Kampanyanın başlangıç tarih ve saati. */
  StartDate?: string;
  /** Kampanyanın bitiş tarih ve saati. */
  EndDate?: string;
  /** Kampanyanın mevcut durumunu belirtir. */
  Status?: number;
  /** Kampanya için belirlenen kullanım limiti. */
  Limit?: number;
}

export interface MerchantCategoriesResponse {
  /** İşlemin başarılı olup olmadığını belirtir. */
  success?: boolean;
  /** Satıcının satış yaptığı kategori bilgilerini içeren liste. */
  data?: MerchantCategoryItem[];
}

export interface MerchantCategoryItem {
  /** Kategorinin benzersiz kimliği. */
  categoryId?: number;
  /** Kategorinin adı. */
  categoryName?: string;
  /** Üst kategori kimliği. */
  parentCategoryId?: number;
  /** Kategorinin durumu. */
  categoryStatus?: boolean;
  /** Üst kategorilere ait detaylı bilgiler. */
  parentCategories?: ParentCategoryItem[];
  /** Kategori sıralama numarası. */
  categorySortId?: number;
  /** Kategorinin seviye bilgisi. */
  categoryLevel?: number;
  /** Kategorinin kampanya bilgisi. */
  isCampaign?: boolean;
  /** Kategori için HX durumunu belirtir. */
  isHX?: boolean;
  /** Kategorinin bir 'en alt kategori' olum olmadığını belirtir */
  isLeaf?: boolean;
}

export interface ParentCategoryItem {
  /** Üst kategorinin benzersiz kimliği. */
  categoryId?: number;
  /** Üst kategorinin adı. */
  categoryName?: string;
  /** Üst kategorinin üst kategori kimliği. */
  parentCategoryId?: number;
  /** Üst kategorinin durumu. */
  categoryStatus?: boolean;
  /** Üst kategorinin sıralama numarası. */
  CategorySortId?: number;
  /** Üst kategorinin seviye bilgisi. */
  CategoryLevel?: number;
}

export interface LimitsResponse {
  /** İşlemin başarılı olup olmadığını belirtir. */
  success?: boolean;
  /** Limit bilgileri ve toplam kayıt sayısını içerir. */
  data?: {
  rowCount?: number;
  limits?: LimitsItem[];
};
}

export interface LimitsItem {
  /** Geçerli limitin alt sınır değerini belirtir. */
  lowerLimit?: number;
  /** Kampanya için belirlenen tutar değerlerinin listesini içerir. */
  campaignAmounts?: number[];
}

export interface BudgetsResponse {
  /** İşlemin başarılı olup olmadığını belirtir. */
  success?: boolean;
  data?: number[];
}

export interface SelfCampaignDiscountDetailResponse {
  /** İşlemin başarılı olup olmadığını belirtir. */
  success?: boolean;
  data?: {
  /** Kampanya tipini belirtir. */
  type?: number;
  /** Kampanya için belirlenen toplam bütçeyi belirtir. */
  budget?: number;
  /** Kampanyada kalan kullanılabilir bütçeyi belirtir. */
  remainingBudget?: number;
  /** Kampanyanın uygulanabilmesi için gerekli olan alt limiti belirtir. */
  conditionAmount?: number;
  /** Uygulanan indirim miktarını belirtir. */
  discountAmount?: number;
  /** Yüzde indirimi kampanyasında uygulanabilecek maksimum indirim tutarını belirtir. */
  maxDiscountAmount?: number;
  /** Kampanyanın maximum kullanım miktarını belirtir. */
  maxUsageAmount?: number;
  /** Kalan kullanılabilir kampanya kullanım sayısını belirtir. */
  remainingUsageCount?: number;
  /** Kampanyanın tekrar edilebilme sayısını belirtir. */
  iterationCount?: number;
  /** Kampanyanın başlangıç tarih ve saatini belirtir. */
  startDate?: string;
  /** Kampanyanın bitiş tarih ve saatini belirtir. */
  endDate?: string;
  /** Kampanyanın mevcut durumunu belirtir. */
  status?: number;
  /** Kampanyanın geçerli olacağı kategori ID listesini içerir. */
  conditionCategories?: string[];
  /** Kampanyanın geçerli olacağı SKU listesini içerir. */
  conditionSkus?: string[];
};
}

export interface CreateSelfCampaignResponse {
  /** İşlemin başarılı olup olmadığını belirtir. */
  success?: boolean;
  /** Oluşturulan kampanyaya ait bilgileri içerir. */
  data?: {
  /** Oluşturulan kampanyanın benzersiz kimliğini belirtir. */
  campaignId?: number;
};
}

export interface SuccessResponse {
  /** İşlemin başarılı olup olmadığını belirtir. */
  success?: boolean;
}

export interface FailResponse {
  /** İşlemin başarısız olduğunu belirtir. */
  success?: boolean;
  /** İşlem sırasında oluşan hata mesajlarını içerir. */
  errors?: string[];
}

/**
 * Sepete TL İndirimi Oluşturma
 *
 * `POST /self-campaign/{merchantId}/tl-discount`
 * Published as "Sepette TL İndirimi Oluşturma".
 */
export interface PostSelfCampaignTlDiscountParams {
  merchantId: string;
}

export type PostSelfCampaignTlDiscountBody = CreateTLSelfCampaignRequest;

export type PostSelfCampaignTlDiscountResponse = CreateSelfCampaignResponse;

/**
 * Sepete Yüzde İndirimi Oluşturma
 *
 * `POST /self-campaign/{merchantId}/percent-discount`
 * Published as "Sepete % İndirimi Oluşturma".
 */
export interface PostSelfCampaignPercentDiscountParams {
  merchantId: string;
}

export type PostSelfCampaignPercentDiscountBody = CreatePercentSelfCampaignRequest;

export type PostSelfCampaignPercentDiscountResponse = CreateSelfCampaignResponse;

/**
 * Sepete X Al Y Öde İndirimi Oluşturma
 *
 * `POST /self-campaign/{merchantId}/xy-discount`
 * Published as "Sepete X Al Y Öde İndirimi Oluşturma".
 */
export interface PostSelfCampaignXyDiscountParams {
  merchantId: string;
}

export type PostSelfCampaignXyDiscountBody = CreateXYSelfCampaignRequest;

export type PostSelfCampaignXyDiscountResponse = CreateSelfCampaignResponse;

/**
 * Sepet İndirimleri Sorgulama
 *
 * `GET /self-campaign/{merchantId}/discounts`
 * Published as "Sepet İndirimleri Sorgulama".
 */
export interface GetSelfCampaignDiscountsQuery {
  /** Hangi sayfanın görüntüleneceğini belirler. */
  page: number;
  pagesize: number;
}

export interface GetSelfCampaignDiscountsParams {
  merchantId: string;
}

export type GetSelfCampaignDiscountsResponse = SelfCampaignDiscountListResponse;

/**
 * Sepet İndirimi Detay Sorgulama
 *
 * `GET /self-campaign/{merchantId}/discount/{campaignId}`
 * Published as "Sepet İndirimi Detay Sorgulama".
 */
export interface GetSelfCampaignDiscountParams {
  merchantId: string;
  campaignId: string;
}

export type GetSelfCampaignDiscountResponse = SelfCampaignDiscountDetailResponse;

/**
 * Sepet İndirimi İptali
 *
 * `POST /self-campaign/{merchantId}/cancel-discount`
 * Published as "Sepet İndirimi İptali".
 */
export interface PostSelfCampaignCancelDiscountParams {
  merchantId: string;
}

export type PostSelfCampaignCancelDiscountBody = CancelSelfCampaignRequest;

export type PostSelfCampaignCancelDiscountResponse = SuccessResponse;

/**
 * Sepet İndirimi Limitleri Sorgulama
 *
 * `GET /self-campaign/{merchantId}/limits`
 * Published as "Sepet İndirimi Limitleri Sorgulama".
 */
export interface GetSelfCampaignLimitsParams {
  merchantId: string;
}

export type GetSelfCampaignLimitsResponse = LimitsResponse;

/**
 * Sepet İndirimi Bütçeleri Sorgulama
 *
 * `GET /self-campaign/{merchantId}/budgets`
 * Published as "Sepet İndirimi Bütçeleri Sorgulama".
 */
export interface GetSelfCampaignBudgetsParams {
  merchantId: string;
}

export type GetSelfCampaignBudgetsResponse = BudgetsResponse;

/**
 * Satıcı Ürün Kategorileri Sorgulama
 *
 * `GET /categories/{merchantId}`
 * Published as "Satıcı Ürün Kategorileri Sorgulama".
 */
export interface GetCategoriesParams {
  merchantId: string;
}

export type GetCategoriesResponse = MerchantCategoriesResponse;
