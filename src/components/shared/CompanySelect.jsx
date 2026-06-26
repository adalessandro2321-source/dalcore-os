import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompanySelect({ companies, value, onChange, placeholder = "Select client" }) {
  const [open, setOpen] = React.useState(false);

  const selected = companies.find(c => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white border-gray-300 text-gray-900 font-normal hover:bg-gray-50"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
          <ChevronsUpDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-white border-gray-300" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command>
          <CommandInput placeholder="Search companies..." />
          <CommandList>
            <CommandEmpty>No company found.</CommandEmpty>
            <CommandGroup>
              {companies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={`${company.name} ${company.type || ''} ${company.city || ''} ${company.email || ''}`}
                  onSelect={() => {
                    onChange(company.id === value ? '' : company.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === company.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate">{company.name}</span>
                    <span className="text-xs text-gray-500">{company.type}{company.city ? ` · ${company.city}` : ''}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}