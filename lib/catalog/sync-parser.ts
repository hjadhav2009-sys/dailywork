export type MeeshoProductAttribute = {
  section: "Product Highlights" | "Additional Details";
  attributeName: string;
  attributeValue: string;
};

export type MeeshoProductDetail = {
  title: string;
  productUrl: string;
  mainImageUrl: string;
  imageUrls: string[];
  price: string;
  rating: string;
  category: string;
  productHighlights: MeeshoProductAttribute[];
  additionalDetails: MeeshoProductAttribute[];
  rawHtmlLength: number;
};

const blockTagPattern =
  /<\/?(?:article|aside|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)[^>]*>/gi;

const sectionEndings = [
  "Product Details",
  "Product Description",
  "Description",
  "Ratings",
  "Reviews",
  "Sold By",
  "Similar Products",
  "More Information",
  "Questions"
];

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function stripNoise(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
}

function htmlToLines(html: string) {
  return decodeHtml(stripNoise(html).replace(blockTagPattern, "\n").replace(/<[^>]+>/g, " "))
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function attrValues(html: string, attrName: string) {
  const values: string[] = [];
  const pattern = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, "gi");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    values.push(decodeHtml(match[1]));
  }

  return values;
}

function metaContent(html: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapedKey}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapedKey}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1]).trim();
    }
  }

  return "";
}

function pageTitle(html: string) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];

  if (h1) {
    return decodeHtml(h1.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  }

  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtml(title).replace(/\s+/g, " ").trim() : "";
}

function parseJsonLd(html: string) {
  const values: unknown[] = [];
  const pattern = /<script\b[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    try {
      values.push(JSON.parse(decodeHtml(match[1]).trim()));
    } catch {
      // Ignore malformed structured data and use visible fallbacks.
    }
  }

  return values.flatMap(flattenJsonLd);
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const graph = Array.isArray(record["@graph"]) ? record["@graph"].flatMap(flattenJsonLd) : [];
  return [record, ...graph];
}

function jsonLdProduct(html: string) {
  return parseJsonLd(html).find((record) => {
    const type = record["@type"];
    return type === "Product" || (Array.isArray(type) && type.includes("Product"));
  });
}

function asString(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  return "";
}

function jsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") {
        return [item];
      }

      if (item && typeof item === "object" && "url" in item) {
        return [asString((item as { url?: unknown }).url)];
      }

      return [];
    });
  }

  const single = asString(value);
  return single ? [single] : [];
}

function absoluteUrl(value: string, baseUrl: string) {
  if (!value || value.startsWith("data:")) {
    return "";
  }

  try {
    return new URL(value, baseUrl || "https://www.meesho.com").toString();
  } catch {
    return "";
  }
}

function imageUrlsFromHtml(html: string, baseUrl: string) {
  const urls = [
    ...attrValues(html, "src"),
    ...attrValues(html, "data-src"),
    ...attrValues(html, "data-original"),
    ...attrValues(html, "content"),
    ...attrValues(html, "srcset").flatMap((srcset) => srcset.split(",").map((part) => part.trim().split(/\s+/)[0] ?? ""))
  ];

  return urls
    .map((url) => absoluteUrl(url, baseUrl))
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(url) || /images/i.test(url));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sectionLines(lines: string[], heading: "Product Highlights" | "Additional Details") {
  const start = lines.findIndex((line) => line.toLowerCase() === heading.toLowerCase());

  if (start < 0) {
    return [];
  }

  const end = lines.findIndex((line, index) => {
    if (index <= start) {
      return false;
    }

    return sectionEndings.some((ending) => ending.toLowerCase() === line.toLowerCase()) || line.toLowerCase().endsWith(" details");
  });

  return lines.slice(start + 1, end > start ? end : undefined);
}

function parseAttributeLines(lines: string[], section: "Product Highlights" | "Additional Details") {
  const attributes: MeeshoProductAttribute[] = [];
  const cleaned = lines.filter((line) => !["-", ":", "|"].includes(line));

  for (let index = 0; index < cleaned.length; index += 1) {
    const line = cleaned[index];
    const colonMatch = line.match(/^([^:]{2,80}):\s*(.+)$/);

    if (colonMatch) {
      attributes.push({
        section,
        attributeName: colonMatch[1].trim(),
        attributeValue: colonMatch[2].trim()
      });
      continue;
    }

    const next = cleaned[index + 1];

    if (next && line.length <= 80 && !next.includes(":")) {
      attributes.push({
        section,
        attributeName: line,
        attributeValue: next
      });
      index += 1;
    }
  }

  return attributes.filter((attribute) => attribute.attributeName && attribute.attributeValue);
}

function offerPrice(product: Record<string, unknown> | undefined) {
  const offers = product?.offers;
  const firstOffer = Array.isArray(offers) ? offers[0] : offers;

  if (firstOffer && typeof firstOffer === "object") {
    const offer = firstOffer as Record<string, unknown>;
    return asString(offer.price) || asString(offer.lowPrice) || asString(offer.highPrice);
  }

  return "";
}

function aggregateRating(product: Record<string, unknown> | undefined) {
  const rating = product?.aggregateRating;

  if (rating && typeof rating === "object") {
    return asString((rating as Record<string, unknown>).ratingValue);
  }

  return "";
}

export function parseMeeshoProductDetailHtml(html: string, pageUrl: string): MeeshoProductDetail {
  const product = jsonLdProduct(html);
  const lines = htmlToLines(html);
  const jsonImages = product ? jsonArray(product.image) : [];
  const imageUrls = unique([
    ...jsonImages.map((url) => absoluteUrl(url, pageUrl)),
    absoluteUrl(metaContent(html, "og:image"), pageUrl),
    ...imageUrlsFromHtml(html, pageUrl)
  ]);
  const title = asString(product?.name) || metaContent(html, "og:title") || pageTitle(html);
  const productUrl = asString(product?.url) || metaContent(html, "og:url") || pageUrl;
  const price = offerPrice(product) || metaContent(html, "product:price:amount");
  const rating = aggregateRating(product);
  const category = asString(product?.category);
  const productHighlights = parseAttributeLines(sectionLines(lines, "Product Highlights"), "Product Highlights");
  const additionalDetails = parseAttributeLines(sectionLines(lines, "Additional Details"), "Additional Details");

  return {
    title,
    productUrl,
    mainImageUrl: imageUrls[0] ?? "",
    imageUrls,
    price,
    rating,
    category,
    productHighlights,
    additionalDetails,
    rawHtmlLength: html.length
  };
}
