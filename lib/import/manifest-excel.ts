import type { PaymentType } from "@prisma/client";
import type { ParseIssue } from "@/lib/parsers/meesho";
import { normalizeSkuForMatching } from "@/lib/sku";
import type { RawImportRow } from "./sku-mappings";

export type ManifestSpreadsheetPreviewRow = {
  sourceType: "MANIFEST_ORDER" | "PICKLIST_SUMMARY";
  rowNumber: number;
  awb?: string;
  courier?: string;
  sku?: string;
  qty?: number;
  color?: string;
  size?: string;
  orderNo?: string;
  productDescription?: string;
  paymentType: PaymentType;
  confidence: number;
  issues: ParseIssue[];
  rawData: RawImportRow;
};

const awbAliases = ["awb", "awbnumber", "trackingnumber", "trackingid", "airwaybill"];
const courierAliases = ["courier", "courierpartner", "logisticspartner", "shippingpartner"];
const skuAliases = ["sku", "skucode", "suppliersku", "supplieridentifier", "productsku", "productid"];
const qtyAliases = ["qty", "quantity", "totalquantity", "totalqty", "orderedqty"];
const colorAliases = ["color", "colour"];
const sizeAliases = ["size", "sizing"];
const orderNoAliases = ["orderno", "ordernumber", "suborderno", "subordernumber", "suborderid", "suborder"];
const productAliases = ["product", "productname", "productdescription", "title", "itemname"];
const paymentAliases = ["payment", "paymenttype", "paymentmode"];
const rowTypeAliases = ["type", "rowtype", "source", "section"];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getValue(row: RawImportRow, aliases: string[]) {
  for (const [key, value] of Object.entries(row)) {
    if (aliases.includes(normalizeHeader(key))) {
      return value.trim();
    }
  }

  return "";
}

function parseQty(value: string) {
  const parsed = Number.parseInt(value.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePaymentType(value: string): PaymentType {
  const normalized = value.toLowerCase();

  if (normalized.includes("cod")) {
    return "COD";
  }

  if (normalized.includes("prepaid") || normalized.includes("online")) {
    return "PREPAID";
  }

  return "UNKNOWN";
}

function isSummaryRow(
  row: RawImportRow,
  input: {
    awb: string;
    explicitType: string;
    sku: string;
    courier: string;
    orderNo: string;
  }
) {
  const joined = Object.values(row).join(" ").toLowerCase();
  const explicitSummary = /summary|picklist|total/.test(input.explicitType.toLowerCase()) || /picklist summary|total qty|total quantity/.test(joined);
  const awbLessSkuQuantity = Boolean(input.sku && !input.courier && !input.orderNo);

  return !input.awb && (explicitSummary || awbLessSkuQuantity);
}

export function parseManifestSpreadsheetRows(rows: RawImportRow[]) {
  return rows.map<ManifestSpreadsheetPreviewRow>((row, index) => {
    const rowNumber = index + 2;
    const awb = getValue(row, awbAliases);
    const rawSku = getValue(row, skuAliases);
    const sku = normalizeSkuForMatching(rawSku);
    const qty = parseQty(getValue(row, qtyAliases)) ?? 1;
    const explicitType = getValue(row, rowTypeAliases);
    const courier = getValue(row, courierAliases);
    const orderNo = getValue(row, orderNoAliases) || awb;
    const sourceType = isSummaryRow(row, { awb, explicitType, sku, courier, orderNo }) ? "PICKLIST_SUMMARY" : "MANIFEST_ORDER";
    const issues: ParseIssue[] = [];

    if (sourceType === "MANIFEST_ORDER" && !awb) {
      issues.push({
        issueType: "MISSING_AWB",
        message: "Manifest row is missing AWB.",
        severity: "ERROR",
        sku
      });
    }

    if (!sku) {
      issues.push({
        issueType: "MISSING_SKU",
        message: "Manifest row is missing SKU.",
        severity: "ERROR",
        awb
      });
    }

    return {
      sourceType,
      rowNumber,
      awb: awb || undefined,
      courier: courier || undefined,
      sku: sku || undefined,
      qty,
      color: getValue(row, colorAliases) || undefined,
      size: getValue(row, sizeAliases) || undefined,
      orderNo: orderNo || undefined,
      productDescription: getValue(row, productAliases) || undefined,
      paymentType: parsePaymentType(getValue(row, paymentAliases)),
      confidence: issues.length > 0 ? 55 : 92,
      issues,
      rawData: row
    };
  });
}
