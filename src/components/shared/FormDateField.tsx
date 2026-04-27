import React, { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateBR, parseDateBR } from "@/lib/validators";

interface FormDateFieldProps {
  label: string;
  value: string; // DD/MM/YYYY or ISO
  onChange: (v: string) => void;
  readOnly?: boolean;
  className?: string;
}

const FormDateField: React.FC<FormDateFieldProps> = ({ label, value, onChange, readOnly, className }) => {
  const [XOpen, setXOpen] = useState(false);

  // Parse current value to Date
  const XParsedDate = (() => {
    if (!value) return undefined;
    // Try DD/MM/YYYY
    const XMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (XMatch) return new Date(parseInt(XMatch[3]), parseInt(XMatch[2]) - 1, parseInt(XMatch[1]));
    // Try ISO
    const XD = new Date(value);
    return isNaN(XD.getTime()) ? undefined : XD;
  })();

  const XDisplayValue = (() => {
    if (!value) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
    return formatDateBR(value);
  })();

  const handleDateSelect = (XDate: Date | undefined) => {
    if (XDate) {
      const XDay = String(XDate.getDate()).padStart(2, "0");
      const XMonth = String(XDate.getMonth() + 1).padStart(2, "0");
      const XYear = XDate.getFullYear();
      onChange(`${XDay}/${XMonth}/${XYear}`);
    } else {
      onChange("");
    }
    setXOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let XVal = e.target.value.replace(/[^\d/]/g, "");
    // Auto-add slashes
    const XDigits = XVal.replace(/\D/g, "");
    if (XDigits.length >= 2 && !XVal.includes("/")) {
      XVal = XDigits.slice(0, 2) + "/" + XDigits.slice(2);
    }
    if (XDigits.length >= 4) {
      XVal = XDigits.slice(0, 2) + "/" + XDigits.slice(2, 4) + "/" + XDigits.slice(4, 8);
    }
    onChange(XVal);
  };

  if (readOnly) {
    return (
      <div className={cn("space-y-1", className)}>
        <label className="block text-xs font-medium text-muted-foreground">{label}</label>
        <input
          type="text"
          value={XDisplayValue}
          readOnly
          className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary"
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-1">
        <input
          type="text"
          value={XDisplayValue}
          onChange={handleInputChange}
          placeholder="DD/MM/AAAA"
          maxLength={10}
          className="flex-1 border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
        />
        <Popover open={XOpen} onOpenChange={setXOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-[34px] w-[34px] shrink-0">
              <CalendarIcon size={14} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={XParsedDate}
              onSelect={handleDateSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default FormDateField;
