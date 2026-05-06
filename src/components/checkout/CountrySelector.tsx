import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface Country {
  code: string;
  name: string;
  dialCode?: string;
}

const countries: Country[] = [
  { code: "BR", name: "Brazil (Brasil)" },
  { code: "US", name: "United States" },
  { code: "MX", name: "Mexico (México)" },
  { code: "CO", name: "Colombia" },
  { code: "AR", name: "Argentina" },
  { code: "PE", name: "Peru (Perú)" },
  { code: "ES", name: "Spain (España)" },
  { code: "PT", name: "Portugal" },
  { code: "CL", name: "Chile" },
  { code: "EC", name: "Ecuador" },
  { code: "AX", name: "Åland Islands" },
  { code: "AL", name: "Albania (Shqipëri)" },
  { code: "DZ", name: "Algeria (‫الجزائر‬‎)" },
  { code: "AS", name: "American Samoa" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AI", name: "Anguilla" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AM", name: "Armenia (Հայաստան)" },
  { code: "AW", name: "Aruba" },
  { code: "AC", name: "Ascension Island" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria (Österreich)" },
  { code: "AZ", name: "Azerbaijan (Azərbaycan)" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain (‫البحرين‬‎)" },
  { code: "BD", name: "Bangladesh (বাংলাদেশ)" },
  { code: "BB", name: "Barbados" },
  { code: "BE", name: "Belgium (België)" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin (Bénin)" },
  { code: "BM", name: "Bermuda" },
  { code: "BT", name: "Bhutan (འབྲུག)" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "IO", name: "British Indian Ocean Territory" },
  { code: "VG", name: "British Virgin Islands" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria (България)" },
  { code: "BF", name: "Burkina Faso" },
  { code: "KH", name: "Cambodia (កម្ពុជា)" },
  { code: "CM", name: "Cameroon (Cameroun)" },
  { code: "CA", name: "Canada" },
  { code: "CV", name: "Cape Verde (Kabu Verdi)" },
  { code: "BQ", name: "Caribbean Netherlands" },
  { code: "KY", name: "Cayman Islands" },
  { code: "CN", name: "China (中国)" },
  { code: "CX", name: "Christmas Island" },
  { code: "CC", name: "Cocos (Keeling) Islands" },
  { code: "KM", name: "Comoros (‫جزر القمر‬‎)" },
  { code: "CK", name: "Cook Islands" },
  { code: "CR", name: "Costa Rica" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "HR", name: "Croatia (Hrvatska)" },
  { code: "CW", name: "Curaçao" },
  { code: "CY", name: "Cyprus (Κύπρος)" },
  { code: "CZ", name: "Czech Republic (Česká republika)" },
  { code: "DK", name: "Denmark (Danmark)" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic (República Dominicana)" },
  { code: "EG", name: "Egypt (‫مصر‬‎)" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea (Guinea Ecuatorial)" },
  { code: "EE", name: "Estonia (Eesti)" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FK", name: "Falkland Islands (Islas Malvinas)" },
  { code: "FO", name: "Faroe Islands (Føroyar)" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland (Suomi)" },
  { code: "FR", name: "France" },
  { code: "GF", name: "French Guiana (Guyane française)" },
  { code: "PF", name: "French Polynesia (Polynésie française)" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia (საქართველო)" },
  { code: "DE", name: "Germany (Deutschland)" },
  { code: "GH", name: "Ghana (Gaana)" },
  { code: "GI", name: "Gibraltar" },
  { code: "GR", name: "Greece (Ελλάδα)" },
  { code: "GL", name: "Greenland (Kalaallit Nunaat)" },
  { code: "GD", name: "Grenada" },
  { code: "GP", name: "Guadeloupe" },
  { code: "GU", name: "Guam" },
  { code: "GT", name: "Guatemala" },
  { code: "GG", name: "Guernsey" },
  { code: "GN", name: "Guinea (Guinée)" },
  { code: "GW", name: "Guinea-Bissau (Guiné Bissau)" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hong Kong (香港)" },
  { code: "HU", name: "Hungary (Magyarország)" },
  { code: "IS", name: "Iceland (Ísland)" },
  { code: "IN", name: "India (भारत)" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IM", name: "Isle of Man" },
  { code: "IL", name: "Israel (‫ישראל‬‎)" },
  { code: "IT", name: "Italy (Italia)" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan (日本)" },
  { code: "JE", name: "Jersey" },
  { code: "JO", name: "Jordan (‫الأردن‬‎)" },
  { code: "KZ", name: "Kazakhstan (Казахстан)" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "XK", name: "Kosovo" },
  { code: "KW", name: "Kuwait (‫الكويت‬‎)" },
  { code: "KG", name: "Kyrgyzstan (Кыргызстан)" },
  { code: "LA", name: "Laos (ລາວ)" },
  { code: "LV", name: "Latvia (Latvija)" },
  { code: "LB", name: "Lebanon (‫لبنان‬‎)" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania (Lietuva)" },
  { code: "LU", name: "Luxembourg" },
  { code: "MO", name: "Macau (澳門)" },
  { code: "MG", name: "Madagascar (Madagasikara)" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritania (‫موريتانيا‬‎)" },
  { code: "MU", name: "Mauritius (Moris)" },
  { code: "YT", name: "Mayotte" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova (Republica Moldova)" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia (Монгол)" },
  { code: "ME", name: "Montenegro (Crna Gora)" },
  { code: "MS", name: "Montserrat" },
  { code: "MA", name: "Morocco (‫المغرب‬‎)" },
  { code: "MZ", name: "Mozambique (Moçambique)" },
  { code: "NA", name: "Namibia (Namibië)" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal (नेपाल)" },
  { code: "NL", name: "Netherlands (Nederland)" },
  { code: "NC", name: "New Caledonia (Nouvelle-Calédonie)" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger (Nijar)" },
  { code: "NG", name: "Nigeria" },
  { code: "NU", name: "Niue" },
  { code: "NF", name: "Norfolk Island" },
  { code: "MK", name: "North Macedonia (Северна Македонија)" },
  { code: "MP", name: "Northern Mariana Islands" },
  { code: "NO", name: "Norway (Norge)" },
  { code: "OM", name: "Oman (‫عُمان‬‎)" },
  { code: "PK", name: "Pakistan (‫پاکستان‬‎)" },
  { code: "PW", name: "Palau" },
  { code: "PS", name: "Palestine (‫فلسطين‬‎)" },
  { code: "PA", name: "Panama (Panamá)" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland (Polska)" },
  { code: "PR", name: "Puerto Rico" },
  { code: "QA", name: "Qatar (‫قطر‬‎)" },
  { code: "RE", name: "Réunion (La Réunion)" },
  { code: "RO", name: "Romania (România)" },
  { code: "RW", name: "Rwanda" },
  { code: "BL", name: "Saint Barthélemy" },
  { code: "SH", name: "Saint Helena" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "MF", name: "Saint Martin" },
  { code: "PM", name: "Saint Pierre and Miquelon" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "São Tomé and Príncipe" },
  { code: "SA", name: "Saudi Arabia (‫المملكة العربية السعودية‬‎)" },
  { code: "SN", name: "Senegal (Sénégal)" },
  { code: "RS", name: "Serbia (Србија)" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SX", name: "Sint Maarten" },
  { code: "SK", name: "Slovakia (Slovensko)" },
  { code: "SI", name: "Slovenia (Slovenija)" },
  { code: "SB", name: "Solomon Islands" },
  { code: "ZA", name: "South Africa" },
  { code: "KR", name: "South Korea (대한민국)" },
  { code: "LK", name: "Sri Lanka (ශ්‍රී ලංකාව)" },
  { code: "SR", name: "Suriname" },
  { code: "SJ", name: "Svalbard and Jan Mayen" },
  { code: "SE", name: "Sweden (Sverige)" },
  { code: "CH", name: "Switzerland (Schweiz)" },
  { code: "TW", name: "Taiwan (台灣)" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand (ไทย)" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TK", name: "Tokelau" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia (‫تونس‬‎)" },
  { code: "TR", name: "Turkey (Türkiye)" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TC", name: "Turks and Caicos Islands" },
  { code: "TV", name: "Tuvalu" },
  { code: "VI", name: "U.S. Virgin Islands" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine (Україна)" },
  { code: "AE", name: "United Arab Emirates (‫الإمارات العربية المتحدة‬‎)" },
  { code: "GB", name: "United Kingdom" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan (Oʻzbekiston)" },
  { code: "VU", name: "Vanuatu" },
  { code: "VA", name: "Vatican City (Città del Vaticano)" },
  { code: "VN", name: "Vietnam (Việt Nam)" },
  { code: "WF", name: "Wallis and Futuna" },
  { code: "EH", name: "Western Sahara (‫الصحراء الغربية‬‎)" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];

const getFlagUrl = (code: string) => {
  const c = code.toLowerCase();
  return `https://flagcdn.com/w40/${c}.png`;
};

const FlagImg = ({ code, size = "w-5 h-4" }: { code: string; size?: string }) => (
  <img
    src={getFlagUrl(code)}
    alt={code}
    className={`${size} object-cover rounded-sm inline-block`}
    loading="lazy"
    onError={(e) => {
      (e.target as HTMLImageElement).style.display = "none";
    }}
  />
);

interface CountrySelectorProps {
  selected: string;
  onChange: (code: string) => void;
}

const CountrySelector = ({ selected, onChange }: CountrySelectorProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = countries.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCountry = countries.find((c) => c.code === selected);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-11 px-3 bg-white border border-[#D5D9D9] rounded-xl hover:border-[#007185] transition-colors w-full"
      >
        <FlagImg code={selected} />
        <span className="text-sm text-[#0F1111] truncate flex-1 text-left">
          {selectedCountry?.name || selected}
        </span>
        <ChevronDown className="w-4 h-4 text-[#565959] shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#D5D9D9] rounded-xl shadow-lg z-50 max-h-[320px] flex flex-col overflow-hidden">
          <div className="p-2 border-b border-[#D5D9D9]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#565959]" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full h-9 pl-8 pr-3 text-sm border border-[#D5D9D9] rounded-lg focus:outline-none focus:border-[#007185] text-[#0F1111] placeholder:text-[#767676]"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#F0F2F2] transition-colors ${
                  c.code === selected ? "bg-[#EDFDFF]" : ""
                }`}
              >
                <FlagImg code={c.code} />
                <span className="text-sm text-[#0F1111] flex-1 truncate">{c.name}</span>
                <span className="text-xs text-[#565959] font-mono">{c.code}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-[#565959] text-center py-4">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountrySelector;
export { countries, getFlagUrl, FlagImg };
