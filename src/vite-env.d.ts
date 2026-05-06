/// <reference types="vite/client" />

interface CfGeo {
  ip?: string;
  ipv4?: string;
  ipv6?: string;
  bestIp?: string;
  city?: string;
  region?: string;
  regionCode?: string;
  country?: string;
  postal?: string;
  timezone?: string;
  currency?: string;
  latitude?: string;
  longitude?: string;
  source?: string;
}

interface Window {
  cfGeo?: CfGeo;
}
