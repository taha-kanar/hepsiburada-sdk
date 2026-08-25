/* eslint-disable */
/**
 * Shipping Entegrasyonu — generated from openapi/shipping.json. Do not edit.
 *
 * Source: shipping-entegrasyonu v1.0, refreshed with `npm run specs:fetch`.
 * Corrections belong in openapi/overlays/, not here.
 */

export interface APIError {
  code?: string;
  detail?: string;
  message?: string;
}

export interface ApiResponse {
  data?: unknown;
  error?: APIError;
  success?: boolean;
}

export interface ProfileLabel {
  cargoFirmId?: number;
  labelId?: number;
  priority?: number;
}

export interface ShippingProfileByMerchantIdExternalModel {
  createdAt?: string;
  id?: string;
  name?: string;
  updatedAt?: string;
}

export interface ShippingProfileByMerchantIdRes {
  profileIds?: ShippingProfileByMerchantIdExternalModel[];
}

export interface ShippingProfileExternalRequest {
  description?: string;
  id?: string;
  merchantId?: string;
  name?: string;
  profileLabels?: ProfileLabel[];
}

export interface ShippingProfileLabelCargoFirm {
  cargoFirmDisplayOrder?: number;
  cargoFirmId?: number;
  cargoFirmName?: string;
  isExceptional?: boolean;
  isVisible?: boolean;
}

/**
 * Kargo Firmaları Listeleme
 *
 * `GET /cargoFirms/{merchantId}`
 */
export interface GetCargoFirmsParams {
  /** MerchantId */
  merchantId: string;
}

export type GetCargoFirmsResponse = ShippingProfileLabelCargoFirm[];

/**
 * Profil Oluşturma
 *
 * `POST /profile/createByMerchantId`
 */
export type PostProfileCreateByMerchantIdBody = ShippingProfileExternalRequest;

export type PostProfileCreateByMerchantIdResponse = ApiResponse;

/**
 * Profil Güncelleme
 *
 * `PUT /profile/updateByMerchantId`
 */
export type PutProfileUpdateByMerchantIdBody = ShippingProfileExternalRequest;

export type PutProfileUpdateByMerchantIdResponse = ApiResponse;

/**
 * Profil Listeleme
 *
 * `GET /profiles/{merchantId}`
 */
export interface GetProfilesParams {
  /** MerchantId */
  merchantId: string;
}

export type GetProfilesResponse = ShippingProfileByMerchantIdRes[];
