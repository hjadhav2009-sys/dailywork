import { normalizeSkuForMatching } from "@/lib/sku";

export type SkuExtractionRule =
  | "default"
  | "last-word"
  | "after-last-hyphen"
  | "square-brackets"
  | "round-brackets"
  | "custom-regex";

export type SkuExtractionInput = {
  title: string | null | undefined;
  rule?: SkuExtractionRule;
  customRegex?: string;
};

export type SkuExtractionResult = {
  sku: string;
  rule: SkuExtractionRule;
};

const skuLikePattern = /(?:[A-Za-z].*\d|\d.*[A-Za-z]|[-_])/;
const connectorPattern = /^(?:&|\+|and)$/i;

function cleanCandidate(value: string | undefined) {
  return normalizeSkuForMatching((value ?? "").replace(/^[\s:([\]-]+|[\s:)\].,]+$/g, ""));
}

function lastBracketValue(title: string, open: string, close: string) {
  const closeIndex = title.lastIndexOf(close);
  const openIndex = title.lastIndexOf(open, closeIndex);

  if (closeIndex !== title.length - 1 || openIndex < 0 || openIndex >= closeIndex) {
    return "";
  }

  return cleanCandidate(title.slice(openIndex + 1, closeIndex));
}

function extractLastWord(title: string) {
  return cleanCandidate(title.split(/\s+/).filter(Boolean).at(-1));
}

function extractAfterLastHyphen(title: string) {
  const index = title.lastIndexOf("-");

  if (index < 0) {
    return "";
  }

  return cleanCandidate(title.slice(index + 1));
}

function extractFromCustomRegex(title: string, customRegex: string | undefined) {
  if (!customRegex) {
    return "";
  }

  try {
    const match = title.match(new RegExp(customRegex));
    return cleanCandidate(match?.[1] ?? match?.[0]);
  } catch {
    return "";
  }
}

function isSkuLikeToken(token: string) {
  return skuLikePattern.test(token);
}

function extractDefaultTail(title: string) {
  const squareBracketSku = lastBracketValue(title, "[", "]");

  if (squareBracketSku) {
    return squareBracketSku;
  }

  const roundBracketSku = lastBracketValue(title, "(", ")");

  if (roundBracketSku) {
    return roundBracketSku;
  }

  const tokens = title.split(/\s+/).filter(Boolean);
  const selected: string[] = [];

  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = cleanCandidate(tokens[index]);

    if (!token) {
      continue;
    }

    const hasSelectedSkuToken = selected.some((part) => isSkuLikeToken(part));
    const canJoinTrailingNumber = /^\d+$/.test(token) && index > 0 && isSkuLikeToken(cleanCandidate(tokens[index - 1]));

    if (selected.length === 0 && (isSkuLikeToken(token) || canJoinTrailingNumber)) {
      selected.unshift(token);
      continue;
    }

    if (selected.length > 0 && (isSkuLikeToken(token) || (hasSelectedSkuToken && connectorPattern.test(token)))) {
      selected.unshift(token);
      continue;
    }

    break;
  }

  if (selected.length > 0) {
    return cleanCandidate(selected.join(" "));
  }

  return extractLastWord(title);
}

export function extractSkuFromTitle(input: SkuExtractionInput | string | null | undefined): SkuExtractionResult {
  const normalizedInput = typeof input === "object" && input !== null ? input : { title: input };
  const title = (normalizedInput.title ?? "").replace(/\s+/g, " ").trim();
  const rule = normalizedInput.rule ?? "default";

  if (!title) {
    return { sku: "", rule };
  }

  const sku =
    rule === "last-word"
      ? extractLastWord(title)
      : rule === "after-last-hyphen"
        ? extractAfterLastHyphen(title)
        : rule === "square-brackets"
          ? lastBracketValue(title, "[", "]")
          : rule === "round-brackets"
            ? lastBracketValue(title, "(", ")")
            : rule === "custom-regex"
              ? extractFromCustomRegex(title, normalizedInput.customRegex)
              : extractDefaultTail(title);

  return {
    sku,
    rule
  };
}
