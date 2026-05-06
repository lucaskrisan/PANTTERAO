import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { User, Mail, Phone, FileText, CheckCircle2, AlertCircle } from "lucide-react";

export interface CustomerData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

interface FormTranslations {
  yourDetails: string;
  fullName: string;
  email: string;
  invalidName: string;
  invalidEmail: string;
}

interface CustomerFormProps {
  data: CustomerData;
  onChange: (data: CustomerData) => void;
  hideDocumentPhone?: boolean;
  t?: FormTranslations;
}

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const isValidCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += parseInt(digits[i]) * (t + 1 - i);
    const remainder = (sum * 10) % 11;
    if ((remainder === 10 ? 0 : remainder) !== parseInt(digits[t])) return false;
  }
  return true;
};

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const isValidPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) return false;
  const ddd = parseInt(digits.slice(0, 2));
  return ddd >= 11 && ddd <= 99;
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

type FieldStatus = "idle" | "valid" | "invalid";

const getFieldStatus = (field: string, value: string, touched: boolean): FieldStatus => {
  if (!touched || !value.trim()) return "idle";
  switch (field) {
    case "name": return value.trim().length >= 3 ? "valid" : "invalid";
    case "email": return isValidEmail(value) ? "valid" : "invalid";
    case "phone": return isValidPhone(value) ? "valid" : "invalid";
    case "cpf": {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 11) return "idle";
      return isValidCPF(value) ? "valid" : "invalid";
    }
    default: return "idle";
  }
};

const fieldMessages: Record<string, Record<string, string>> = {
  name: { invalid: "Nome deve ter pelo menos 3 caracteres" },
  email: { invalid: "E-mail inválido" },
  phone: { invalid: "Celular inválido. Use DDD + 9 dígitos" },
  cpf: { invalid: "CPF inválido" },
};

const inputBase =
  "h-11 pl-10 pr-10 bg-white border-[#D5D9D9] text-[#0F1111] placeholder:text-[#767676] rounded-xl transition-all duration-200";
const statusClasses: Record<FieldStatus, string> = {
  idle: "focus:border-[#007185] focus:ring-[#007185]",
  valid: "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500",
  invalid: "border-red-400 focus:border-red-500 focus:ring-red-500",
};

const StatusIcon = ({ status }: { status: FieldStatus }) => {
  if (status === "valid") return <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />;
  if (status === "invalid") return <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />;
  return null;
};

const CustomerForm = ({ data, onChange, hideDocumentPhone, t }: CustomerFormProps) => {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleChange = (field: keyof CustomerData, value: string) => {
    let formatted = value;
    if (field === "name" && value.length > 100) return;
    if (field === "email" && value.length > 255) return;
    if (field === "cpf") formatted = formatCPF(value);
    if (field === "phone") formatted = formatPhone(value);
    if (field === "name" || field === "email") {
      formatted = formatted.replace(/<[^>]*>/g, '');
    }
    onChange({ ...data, [field]: formatted });
  };

  const nameStatus = getFieldStatus("name", data.name, !!touched.name);
  const emailStatus = getFieldStatus("email", data.email, !!touched.email);
  const phoneStatus = getFieldStatus("phone", data.phone, !!touched.phone);
  const cpfStatus = getFieldStatus("cpf", data.cpf, !!touched.cpf);

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-[#565959] uppercase tracking-wider">
        {t?.yourDetails ?? (hideDocumentPhone ? "Your details" : "Seus dados")}
      </p>

      {/* Name */}
      <div className="space-y-1">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#565959]" />
          <Input
            value={data.name}
            onChange={(e) => handleChange("name", e.target.value)}
            onBlur={() => handleBlur("name")}
            placeholder={t?.fullName ?? (hideDocumentPhone ? "Full name" : "Nome completo")}
            autoComplete="name"
            className={`${inputBase} ${statusClasses[nameStatus]}`}
          />
          <StatusIcon status={nameStatus} />
        </div>
        {nameStatus === "invalid" && (
          <p className="text-xs text-red-500 pl-1">{t?.invalidName ?? fieldMessages.name.invalid}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#565959]" />
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={data.email}
            onChange={(e) => handleChange("email", e.target.value)}
            onBlur={() => handleBlur("email")}
            placeholder={t?.email ?? (hideDocumentPhone ? "Email" : "E-mail")}
            className={`${inputBase} ${statusClasses[emailStatus]}`}
          />
          <StatusIcon status={emailStatus} />
        </div>
        {emailStatus === "invalid" && (
          <p className="text-xs text-red-500 pl-1">{t?.invalidEmail ?? fieldMessages.email.invalid}</p>
        )}
      </div>

      {!hideDocumentPhone && (
        <>
          {/* Phone */}
          <div className="space-y-1">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#565959]" />
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={data.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                onBlur={() => handleBlur("phone")}
                placeholder="Celular (WhatsApp)"
                className={`${inputBase} ${statusClasses[phoneStatus]}`}
              />
              <StatusIcon status={phoneStatus} />
            </div>
            {phoneStatus === "invalid" && (
              <p className="text-xs text-red-500 pl-1">{fieldMessages.phone.invalid}</p>
            )}
          </div>

          {/* CPF */}
          <div className="space-y-1">
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#565959]" />
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={data.cpf}
                onChange={(e) => handleChange("cpf", e.target.value)}
                onBlur={() => handleBlur("cpf")}
                placeholder="CPF"
                className={`${inputBase} ${statusClasses[cpfStatus]}`}
              />
              <StatusIcon status={cpfStatus} />
            </div>
            {cpfStatus === "invalid" && (
              <p className="text-xs text-red-500 pl-1">{fieldMessages.cpf.invalid}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerForm;