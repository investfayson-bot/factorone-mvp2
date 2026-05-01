"use client";

type ModeTabsProps = {
  value: "PERSONAL" | "PROFESSIONAL" | "CRM";
  onChange: (mode: "PERSONAL" | "PROFESSIONAL" | "CRM") => void;
};

const tabs: Array<{ label: string; value: "PERSONAL" | "PROFESSIONAL" | "CRM" }> = [
  { label: "Personal", value: "PERSONAL" },
  { label: "Professional", value: "PROFESSIONAL" },
  { label: "CRM", value: "CRM" }
];

export function ModeTabs({ value, onChange }: ModeTabsProps) {
  return (
    <div className="mode-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={tab.value === value ? "active" : ""}
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
