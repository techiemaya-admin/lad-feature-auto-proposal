import React, { useMemo } from "react";
import {
  Target,
  Users,
  Plug,
  FolderOpen,
  Send,
  Flame,
  CreditCard,
  Coins,
  FileText,
  Crosshair,
  Sun,
  Moon,
  Cpu,
  Mail,
  MailCheck,
} from "lucide-react";
import type { CompanySummary } from "../../types/company";
import { useTheme } from "../theme-provider";
import { CustomDropdown, type DropdownOption } from "../ui/custom-dropdown";

export interface AIModelOption {
  id: string;
  name: string;
  provider: "deepseek" | "gemini";
  badge: string;
}

export const AVAILABLE_AI_MODELS: AIModelOption[] = [
  { id: "deepseek-flash", name: "DeepSeek Flash", provider: "deepseek", badge: "Fast & Accurate" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "deepseek", badge: "High Reasoning" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", badge: "Google Multimodal" },
  { id: "gemini-pro-latest", name: "Gemini 1.5 Pro", provider: "gemini", badge: "Google Pro" },
];

interface LadSettingsHeaderProps {
  companies: CompanySummary[];
  activeCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  activeTab: string;
  onSelectTab?: (tab: string) => void;
  activeAiModel?: string;
  onSelectAiModel?: (modelId: string) => void;
  onOpenVoiceInbox?: () => void;
  voiceInboxConnected?: boolean | null;
}

export const LadSettingsHeader: React.FC<LadSettingsHeaderProps> = ({
  companies,
  activeCompanyId,
  onSelectCompany,
  activeTab = "businessprofile",
  onSelectTab,
  activeAiModel = "deepseek-flash",
  onSelectAiModel,
  onOpenVoiceInbox,
  voiceInboxConnected = null,
}) => {
  const { theme, setTheme } = useTheme();
  const activeCompany = companies.find((c) => c.company_id === activeCompanyId) || companies[0];
  const companyInitials = activeCompany?.company_name
    ? activeCompany.company_name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 3)
        .toUpperCase()
    : "-";

  const tabs = [
    { id: "businessprofile", label: "Business Profile", icon: Target },
    { id: "team", label: "Team", icon: Users },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "voiceinbox", label: "Voice & Inbox", icon: Mail },
    { id: "mediahub", label: "Media Hub", icon: FolderOpen },
    { id: "coldoutbox", label: "Cold Outbox", icon: Send },
    { id: "warmoutbox", label: "Warm Outbox", icon: Flame },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "credits", label: "Credits", icon: Coins },
    { id: "proposals", label: "Auto Proposal", icon: FileText },
    { id: "icp", label: "ICP Strategy", icon: Crosshair },
  ];

  const aiModelDropdownOptions: DropdownOption[] = useMemo(
    () =>
      AVAILABLE_AI_MODELS.map((m) => ({
        value: m.id,
        label: m.name,
        badge: m.badge,
        icon: <Cpu className="size-3.5" />,
      })),
    []
  );

  const tenantDropdownOptions: DropdownOption[] = useMemo(
    () =>
      companies.map((c) => ({
        value: c.company_id,
        label: c.company_name,
        dotColor: c.company_id === activeCompanyId ? "bg-emerald-500" : "bg-primary/40",
      })),
    [companies, activeCompanyId]
  );

  return (
    <header className="bg-gradient-to-b from-blue-50/60 via-background to-background dark:from-[#040e36] dark:via-background dark:to-background border-b border-border/60 pb-3 pt-4 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-4">
        {/* Top Company Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            {/* Logo Avatar Badge */}
            <div className="size-11 rounded-full bg-white dark:bg-[#1A2A43] shadow-xs border border-border/80 flex items-center justify-center text-[#0B1957] dark:text-[#2B7CFF] font-bold text-base select-none">
              <span className="tracking-tight">{companyInitials}</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-foreground font-bold text-base tracking-tight">
                  {activeCompany?.company_name.toLowerCase().replace(/\s+/g, "") || "workspace"}
                </h1>
              </div>
              <p className="text-muted-foreground text-xs font-normal">
                {activeCompany?.location || "Workspace settings"}
              </p>
            </div>
          </div>

          {/* Right Header Controls: AI Model Switcher, Tenant Switcher & Theme */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* AI Model Selector */}
            <CustomDropdown
              size="sm"
              value={activeAiModel}
              onChange={(val) => onSelectAiModel?.(val)}
              options={aiModelDropdownOptions}
              prefix={<Cpu className="size-3.5 text-primary" />}
              aria-label="Select AI Model"
              className="h-8 rounded-xl font-semibold text-xs shadow-xs"
            />

            <button
              type="button"
              onClick={onOpenVoiceInbox}
              disabled={!onOpenVoiceInbox || !activeCompanyId}
              className="inline-flex h-8 items-center gap-2 rounded-xl border border-border/80 bg-card px-3 text-xs font-semibold text-foreground shadow-xs transition-all hover:-translate-y-px hover:border-primary/30 hover:bg-primary/[0.04] disabled:pointer-events-none disabled:opacity-70"
              title="Configure proposal voice and connected inbox"
            >
              {voiceInboxConnected ? (
                <MailCheck className="size-3.5 text-emerald-500" />
              ) : (
                <Mail className="size-3.5 text-primary" />
              )}
              <span className="hidden md:inline">Voice &amp; inbox</span>
              {voiceInboxConnected && <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
            </button>

            {/* Company Switcher Dropdown */}
            <CustomDropdown
              size="sm"
              value={activeCompanyId}
              onChange={(val) => onSelectCompany(val)}
              options={tenantDropdownOptions}
              prefix={<span className="text-muted-foreground text-xs font-normal">Tenant:</span>}
              aria-label="Select Tenant Company"
              className="h-8 rounded-xl font-semibold text-xs shadow-xs"
            />


            {/* Dark / Light Mode Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="size-8 rounded-xl border border-border/80 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-xs cursor-pointer"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="size-4 text-amber-400" />
              ) : (
                <Moon className="size-4 text-slate-700" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1.5 overflow-x-auto pt-1 no-scrollbar">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab?.(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition-all select-none cursor-pointer ${
                  isSelected
                    ? "bg-card text-[#0B1957] dark:text-[#2B7CFF] border border-border/80 shadow-xs font-bold ring-1 ring-[#2B7CFF]/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
