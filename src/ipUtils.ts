import axios from "axios";

export interface IPInfo {
  ip: string;
  countryCode: string;
  countryName: string;
  region: string;
  city: string;
  org: string;
}

export function extractIPAddresses(text: string): string[] {
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const matches = text.match(ipRegex) || [];
  return matches;
}

export async function lookupIP(ip: string): Promise<IPInfo> {
  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    const data = response.data;

    return {
      ip: ip,
      countryCode: data.country_code || "Unknown",
      countryName: data.country_name || "Unknown",
      region: data.region || "Unknown",
      city: data.city || "Unknown",
      org: data.org || "Unknown",
    };
  } catch (error) {
    throw new Error(`Failed to lookup IP ${ip}: ${error}`);
  }
}
