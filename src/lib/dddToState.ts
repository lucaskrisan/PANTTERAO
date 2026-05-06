// Map Brazilian phone DDD (area code) to state abbreviation
const DDD_TO_STATE: Record<string, string> = {
  // SP
  '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
  // RJ
  '21': 'RJ', '22': 'RJ', '24': 'RJ',
  // ES
  '27': 'ES', '28': 'ES',
  // MG
  '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG', '38': 'MG',
  // PR
  '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
  // SC
  '47': 'SC', '48': 'SC', '49': 'SC',
  // RS
  '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
  // DF
  '61': 'DF',
  // GO
  '62': 'GO', '64': 'GO',
  // TO
  '63': 'TO',
  // MT
  '65': 'MT', '66': 'MT',
  // MS
  '67': 'MS',
  // AC
  '68': 'AC',
  // RO
  '69': 'RO',
  // BA
  '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
  // SE
  '79': 'SE',
  // PE
  '81': 'PE', '87': 'PE',
  // AL
  '82': 'AL',
  // PB
  '83': 'PB',
  // RN
  '84': 'RN',
  // CE
  '85': 'CE', '88': 'CE',
  // PI
  '86': 'PI', '89': 'PI',
  // MA
  '98': 'MA', '99': 'MA',
  // PA
  '91': 'PA', '93': 'PA', '94': 'PA',
  // AM
  '92': 'AM', '97': 'AM',
  // RR
  '95': 'RR',
  // AP
  '96': 'AP',
};

export function getStateFromPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const ddd = digits.slice(0, 2);
  return DDD_TO_STATE[ddd] || null;
}
