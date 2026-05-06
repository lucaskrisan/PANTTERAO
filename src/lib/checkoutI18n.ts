/**
 * Checkout i18n translations based on country code.
 * Covers the main languages of our international audience.
 */

export interface CheckoutTranslations {
  yourCountry: string;
  creditCard: string;
  securePayment: string;
  payButton: (amount: string) => string;
  fillRequired: string;
  invalidEmail: string;
  paymentError: string;
  paymentSuccess: string;
  name: string;
  email: string;
  searchCountry: string;
  couponPlaceholder: string;
  couponApply: string;
  orderSummary: string;
  discount: string;
  total: string;
  secureCheckout: string;
  guaranteeText: string;
  steps: { country: string; details: string; payment: string; confirmation: string };
  card: { holder: string; expire: string; placeholder: string };
  reservedPrefix: string;
  reservedSuffix: string;
  trust: {
    securePayment: string;
    dataProtected: string;
    ssl: string;
    agreePrefix: string;
    termsOfUse: string;
    and: string;
    privacyPolicy: string;
    agreeSuffix: string;
  };
  form: {
    yourDetails: string;
    fullName: string;
    email: string;
    invalidName: string;
    invalidEmail: string;
  };
}

const pt: CheckoutTranslations = {
  yourCountry: "Seu país",
  creditCard: "Cartão de Crédito",
  securePayment: "Pagamento seguro internacional via Stripe",
  payButton: (amount) => `Pagar $${amount}`,
  fillRequired: "Preencha todos os campos obrigatórios",
  invalidEmail: "E-mail inválido",
  paymentError: "Erro ao processar pagamento",
  paymentSuccess: "Pagamento processado com sucesso!",
  name: "Seu nome completo",
  email: "Seu e-mail",
  searchCountry: "Buscar país...",
  couponPlaceholder: "Cupom de desconto",
  couponApply: "Aplicar",
  orderSummary: "Resumo do pedido",
  discount: "Desconto",
  total: "Total",
  secureCheckout: "Seus dados estão protegidos com criptografia SSL",
  guaranteeText: "Garantia de 7 dias • Compra 100% segura",
  steps: { country: "País", details: "Dados", payment: "Pagamento", confirmation: "Confirmação" },
  card: { holder: "Titular", expire: "Validade", placeholder: "NOME NO CARTÃO" },
  reservedPrefix: "🛒 Seu pedido está reservado por ",
  reservedSuffix: " — Complete o checkout!",
  trust: {
    securePayment: "Pagamento seguro",
    dataProtected: "Dados protegidos",
    ssl: "SSL 256 bits",
    agreePrefix: "Ao continuar, você concorda com os ",
    termsOfUse: "termos de uso",
    and: " e ",
    privacyPolicy: "política de privacidade",
    agreeSuffix: ".",
  },
  form: {
    yourDetails: "Seus dados",
    fullName: "Nome completo",
    email: "E-mail",
    invalidName: "Nome deve ter pelo menos 3 caracteres",
    invalidEmail: "E-mail inválido",
  },
};

const en: CheckoutTranslations = {
  yourCountry: "Your country",
  creditCard: "Credit Card",
  securePayment: "Secure international payment via Stripe",
  payButton: (amount) => `Pay $${amount}`,
  fillRequired: "Please fill in all required fields",
  invalidEmail: "Invalid email address",
  paymentError: "Payment processing failed",
  paymentSuccess: "Payment processed successfully!",
  name: "Your full name",
  email: "Your email",
  searchCountry: "Search country...",
  couponPlaceholder: "Discount code",
  couponApply: "Apply",
  orderSummary: "Order summary",
  discount: "Discount",
  total: "Total",
  secureCheckout: "Your data is protected with SSL encryption",
  guaranteeText: "7-day guarantee • 100% secure purchase",
  steps: { country: "Country", details: "Details", payment: "Payment", confirmation: "Confirmation" },
  card: { holder: "Cardholder", expire: "Expires", placeholder: "FULL NAME" },
  reservedPrefix: "🛒 Your order is reserved for ",
  reservedSuffix: " — Complete checkout!",
  trust: {
    securePayment: "Secure payment",
    dataProtected: "Data protected",
    ssl: "256-bit SSL",
    agreePrefix: "By continuing, you agree to the ",
    termsOfUse: "terms of use",
    and: " and ",
    privacyPolicy: "privacy policy",
    agreeSuffix: ".",
  },
  form: {
    yourDetails: "Your details",
    fullName: "Full name",
    email: "Email",
    invalidName: "Name must be at least 3 characters",
    invalidEmail: "Invalid email address",
  },
};

const es: CheckoutTranslations = {
  yourCountry: "Tu país",
  creditCard: "Tarjeta de Crédito",
  securePayment: "Pago seguro internacional vía Stripe",
  payButton: (amount) => `Pagar $${amount}`,
  fillRequired: "Completa todos los campos obligatorios",
  invalidEmail: "Correo electrónico inválido",
  paymentError: "Error al procesar el pago",
  paymentSuccess: "¡Pago procesado exitosamente!",
  name: "Tu nombre completo",
  email: "Tu correo electrónico",
  searchCountry: "Buscar país...",
  couponPlaceholder: "Código de descuento",
  couponApply: "Aplicar",
  orderSummary: "Resumen del pedido",
  discount: "Descuento",
  total: "Total",
  secureCheckout: "Tus datos están protegidos con encriptación SSL",
  guaranteeText: "Garantía de 7 días • Compra 100% segura",
  steps: { country: "País", details: "Datos", payment: "Pago", confirmation: "Confirmación" },
  card: { holder: "Titular", expire: "Vence", placeholder: "NOMBRE COMPLETO" },
  reservedPrefix: "🛒 Tu pedido está reservado por ",
  reservedSuffix: " — ¡Completa el checkout!",
  trust: {
    securePayment: "Pago seguro",
    dataProtected: "Datos protegidos",
    ssl: "SSL 256 bits",
    agreePrefix: "Al continuar, aceptas los ",
    termsOfUse: "términos de uso",
    and: " y la ",
    privacyPolicy: "política de privacidad",
    agreeSuffix: ".",
  },
  form: {
    yourDetails: "Tus datos",
    fullName: "Nombre completo",
    email: "Correo electrónico",
    invalidName: "El nombre debe tener al menos 3 caracteres",
    invalidEmail: "Correo electrónico inválido",
  },
};

const fr: CheckoutTranslations = {
  yourCountry: "Votre pays",
  creditCard: "Carte de crédit",
  securePayment: "Paiement international sécurisé via Stripe",
  payButton: (amount) => `Payer $${amount}`,
  fillRequired: "Veuillez remplir tous les champs obligatoires",
  invalidEmail: "Adresse e-mail invalide",
  paymentError: "Erreur lors du traitement du paiement",
  paymentSuccess: "Paiement traité avec succès !",
  name: "Votre nom complet",
  email: "Votre e-mail",
  searchCountry: "Rechercher un pays...",
  couponPlaceholder: "Code de réduction",
  couponApply: "Appliquer",
  orderSummary: "Récapitulatif de commande",
  discount: "Réduction",
  total: "Total",
  secureCheckout: "Vos données sont protégées par le cryptage SSL",
  guaranteeText: "Garantie de 7 jours • Achat 100% sécurisé",
  steps: { country: "Pays", details: "Détails", payment: "Paiement", confirmation: "Confirmation" },
  card: { holder: "Titulaire", expire: "Expire", placeholder: "NOM COMPLET" },
  reservedPrefix: "🛒 Votre commande est réservée pour ",
  reservedSuffix: " — Finalisez le paiement !",
  trust: {
    securePayment: "Paiement sécurisé",
    dataProtected: "Données protégées",
    ssl: "SSL 256 bits",
    agreePrefix: "En continuant, vous acceptez les ",
    termsOfUse: "conditions d'utilisation",
    and: " et la ",
    privacyPolicy: "politique de confidentialité",
    agreeSuffix: ".",
  },
  form: {
    yourDetails: "Vos coordonnées",
    fullName: "Nom complet",
    email: "E-mail",
    invalidName: "Le nom doit contenir au moins 3 caractères",
    invalidEmail: "Adresse e-mail invalide",
  },
};

const de: CheckoutTranslations = {
  yourCountry: "Ihr Land",
  creditCard: "Kreditkarte",
  securePayment: "Sichere internationale Zahlung über Stripe",
  payButton: (amount) => `$${amount} bezahlen`,
  fillRequired: "Bitte füllen Sie alle Pflichtfelder aus",
  invalidEmail: "Ungültige E-Mail-Adresse",
  paymentError: "Fehler bei der Zahlungsverarbeitung",
  paymentSuccess: "Zahlung erfolgreich verarbeitet!",
  name: "Ihr vollständiger Name",
  email: "Ihre E-Mail",
  searchCountry: "Land suchen...",
  couponPlaceholder: "Rabattcode",
  couponApply: "Anwenden",
  orderSummary: "Bestellübersicht",
  discount: "Rabatt",
  total: "Gesamt",
  secureCheckout: "Ihre Daten sind durch SSL-Verschlüsselung geschützt",
  guaranteeText: "7-Tage-Garantie • 100% sicherer Kauf",
  steps: { country: "Land", details: "Daten", payment: "Zahlung", confirmation: "Bestätigung" },
  card: { holder: "Karteninhaber", expire: "Gültig bis", placeholder: "VOLLSTÄNDIGER NAME" },
  reservedPrefix: "🛒 Ihre Bestellung ist reserviert für ",
  reservedSuffix: " — Kasse abschließen!",
  trust: {
    securePayment: "Sichere Zahlung",
    dataProtected: "Daten geschützt",
    ssl: "256-Bit-SSL",
    agreePrefix: "Indem Sie fortfahren, stimmen Sie den ",
    termsOfUse: "Nutzungsbedingungen",
    and: " und der ",
    privacyPolicy: "Datenschutzerklärung",
    agreeSuffix: " zu.",
  },
  form: {
    yourDetails: "Ihre Angaben",
    fullName: "Vollständiger Name",
    email: "E-Mail",
    invalidName: "Der Name muss mindestens 3 Zeichen lang sein",
    invalidEmail: "Ungültige E-Mail-Adresse",
  },
};

const it: CheckoutTranslations = {
  yourCountry: "Il tuo paese",
  creditCard: "Carta di credito",
  securePayment: "Pagamento internazionale sicuro tramite Stripe",
  payButton: (amount) => `Paga $${amount}`,
  fillRequired: "Compila tutti i campi obbligatori",
  invalidEmail: "Indirizzo email non valido",
  paymentError: "Errore nell'elaborazione del pagamento",
  paymentSuccess: "Pagamento elaborato con successo!",
  name: "Il tuo nome completo",
  email: "La tua email",
  searchCountry: "Cerca paese...",
  couponPlaceholder: "Codice sconto",
  couponApply: "Applica",
  orderSummary: "Riepilogo ordine",
  discount: "Sconto",
  total: "Totale",
  secureCheckout: "I tuoi dati sono protetti con crittografia SSL",
  guaranteeText: "Garanzia di 7 giorni • Acquisto 100% sicuro",
  steps: { country: "Paese", details: "Dati", payment: "Pagamento", confirmation: "Conferma" },
  card: { holder: "Intestatario", expire: "Scadenza", placeholder: "NOME COMPLETO" },
  reservedPrefix: "🛒 Il tuo ordine è riservato per ",
  reservedSuffix: " — Completa il checkout!",
  trust: {
    securePayment: "Pagamento sicuro",
    dataProtected: "Dati protetti",
    ssl: "SSL 256 bit",
    agreePrefix: "Continuando, accetti i ",
    termsOfUse: "termini di utilizzo",
    and: " e l'",
    privacyPolicy: "informativa sulla privacy",
    agreeSuffix: ".",
  },
  form: {
    yourDetails: "I tuoi dati",
    fullName: "Nome completo",
    email: "Email",
    invalidName: "Il nome deve avere almeno 3 caratteri",
    invalidEmail: "Indirizzo email non valido",
  },
};

// Map country code to language
const countryToLang: Record<string, string> = {
  BR: "pt", PT: "pt", MZ: "pt", AO: "pt", CV: "pt", ST: "pt",
  US: "en", GB: "en", AU: "en", CA: "en", IE: "en", NZ: "en", JM: "en", SG: "en", ZA: "en", NG: "en", GH: "en", KE: "en", PH: "en", IN: "en",
  MX: "es", CO: "es", AR: "es", PE: "es", CL: "es", EC: "es", VE: "es", UY: "es", PY: "es", BO: "es", CR: "es", PA: "es", DO: "es", GT: "es", HN: "es", SV: "es", NI: "es", CU: "es", ES: "es", PR: "es",
  FR: "fr", BE: "fr", CH: "fr", SN: "fr", CI: "fr", CM: "fr", HT: "fr",
  DE: "de", AT: "de",
  IT: "it",
};

const translations: Record<string, CheckoutTranslations> = { pt, en, es, fr, de, it };

export function getCheckoutLang(countryCode: string): "pt" | "en" | "es" | "fr" | "de" | "it" {
  return (countryToLang[countryCode] || "en") as any;
}

export function getCheckoutTranslations(countryCode: string): CheckoutTranslations {
  const lang = countryToLang[countryCode] || "en";
  return translations[lang] || en;
}
