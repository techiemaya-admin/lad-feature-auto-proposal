import React, { useState } from "react";
import { Sparkles, Globe, Share2, X, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/button";

interface AiAutoFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: Record<string, string>) => void;
  companyName: string;
}

export const AiAutoFillModal: React.FC<AiAutoFillModalProps> = ({
  isOpen,
  onClose,
  onApply,
  companyName,
}) => {
  const [sourceType, setSourceType] = useState<"website" | "linkedin">("website");
  const [url, setUrl] = useState("https://mrlad.ai");
  const [step, setStep] = useState<"input" | "analyzing" | "completed">("input");

  if (!isOpen) return null;

  const handleAnalyze = () => {
    setStep("analyzing");

    // Realistic AI extraction simulation
    setTimeout(() => {
      setStep("completed");
    }, 1500);
  };


  const handleApplyData = () => {
    onApply({
      companyName: companyName || "MR LAD",
      industry: "B2B, Lead Generation, Marketing Technology",
      website: url,
      companyLocation: "LAD, UAE",
      valueProposition: "MR LAD is an AI-powered sales assistant for B2B outbound teams, turning cold outreach into warm leads with multi-channel personalization and intelligent prospect scoring.",
      productsServices: "AI Multi-Channel Sales Agent, Dynamic Proposal Automation, Lead Discovery & ICP Scoring, AI Email & LinkedIn Outreach.",
      targetCustomers: "B2B enterprise sales leaders, SDR teams, growth agencies, and B2B SaaS founders looking to scale qualified pipelines without adding headcount.",
      companyDescription: "Mid-market to enterprise B2B companies looking for automated outbound pipeline generation and high-converting personalized sales collateral.",
      icpJobTitles: "Founders, CXO, VP Sales, VP Marketing, Head of Growth, Managing Director",
      icpDomainNiche: "B2B SaaS, Professional Services, Technology, Marketing Agencies",
      icpLocations: "India, USA, UK, UAE, Singapore",
      icpPainPoints: "High customer acquisition costs, low response rates on generic cold outreach, manual proposal generation delays, inconsistent lead pipeline flow.",
      icpDecisionDrivers: "Speed to pipeline, predictable ROI, high personalization accuracy, automated closing workflows.",
      icpTriggers: "Hiring new SDRs, launching a new B2B product line, entering a new geo, missing quarterly pipeline targets.",
      icpCompanySizeFrom: "10",
      icpCompanySizeTo: "500+",
      personaName: "Sneha",
      personaTitle: "Head of Growth",
      styleGuide: "Direct, professional, consultative, value-led",
      toneAndVoice: "Friendly, confident, low-jargon, executive-ready",
      dosAndDonts: "Do focus on ROI metrics and verified case proof. Don't use spammy sales buzzwords or aggressive follow-up tactics.",
      valueStatement: "Help B2B sales teams generate 3x more qualified meetings in 30 days with AI-driven discovery and automated proposals.",
      caseStories: "Helped over 150+ B2B agencies double their qualified discovery calls and reduce proposal preparation time from 4 hours to under 30 seconds.",
      compliantGuarantee: "100% money back guarantee if not satisfied within 14 days of activation.",
      competitors: "Apollo.io, Instantly.ai, Lemlist, Smartlead, PandaDoc",
      uniqueExperience: "Over 8+ years building high-converting outbound pipelines and AI sales automation workflows for high-growth tech startups.",
      socialCredentials: "Featured in Forbes 30 Under 30, trusted by 500+ successful client deployments globally.",
      twelveMonthMetrics: "Average $450k net-new ARR added per client in the first 12 months of deployment.",
      averageLifecycle: "12 months with 94% retention rate and ongoing pipeline optimization.",
      revenueResults: "Generated over $18.5M in qualified sales pipeline across client accounts in the last 18 months.",
      averageDealSize: "$25,000 - $80,000 annual contract value.",
      salesCycleTime: "3 to 6 weeks from first touch to close.",
      idealBuyerCriteria: "B2B companies with 10-500 employees, minimum $1M ARR, and an active outbound sales focus.",
      commonObjections: "\"We already do cold email in-house\" -> Show how AI multi-channel increases response rates 4x and eliminates manual research.\n\"How fast to see results?\" -> First qualified leads booked within 7-10 days of campaign launch.",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#1A2A43] border border-[#2B7CFF]/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-[#E0E0E0]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#0B1957] border border-[#2B7CFF]/40 flex items-center justify-center text-[#2B7CFF]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Auto-fill Profile with AI</h3>
              <p className="text-xs text-muted-foreground">Scrape and analyze positioning, ICP & offer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {step === "input" && (
            <>
              {/* Source Type Selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSourceType("website");
                    setUrl("https://mrlad.ai");
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    sourceType === "website"
                      ? "border-[#2B7CFF] bg-[#2B7CFF]/15 text-white"
                      : "border-border/60 bg-[#14233a] text-muted-foreground hover:text-white"
                  }`}
                >
                  <Globe className="size-4 text-[#2B7CFF]" />
                  <span>Company Website</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSourceType("linkedin");
                    setUrl("https://linkedin.com/company/mrlad");
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    sourceType === "linkedin"
                      ? "border-[#2B7CFF] bg-[#2B7CFF]/15 text-white"
                      : "border-border/60 bg-[#14233a] text-muted-foreground hover:text-white"
                  }`}
                >
                  <Share2 className="size-4 text-[#2B7CFF]" />
                  <span>LinkedIn Company</span>
                </button>
              </div>

              {/* URL Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200">
                  {sourceType === "website" ? "Website URL" : "LinkedIn Company Page URL"}
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={sourceType === "website" ? "https://yourcompany.com" : "https://linkedin.com/company/yourbrand"}
                  className="w-full h-10 px-3.5 rounded-xl border border-border/80 bg-[#14233a] text-xs text-white placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-[#2B7CFF]"
                />
                <p className="text-[11px] text-muted-foreground">
                  AI will extract company positioning, value proposition, ideal customer profiles, and offer details.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <Button variant="ghost" size="sm" onClick={onClose} className="h-9 px-4 text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAnalyze}
                  className="h-9 px-5 bg-[#2B7CFF] hover:bg-[#2563eb] text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-[#2B7CFF]/20"
                >
                  <Sparkles className="size-3.5" />
                  <span>Analyze & Extract</span>
                </Button>
              </div>
            </>
          )}

          {step === "analyzing" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="size-14 rounded-full bg-[#0B1957] border border-[#2B7CFF] flex items-center justify-center text-[#2B7CFF]">
                  <Loader2 className="size-7 animate-spin text-[#2B7CFF]" />
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Extracting 14-Factor Business Signals</h4>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Parsing {url} for value props, buyer triggers, pricing models, and case proofs...
                </p>
              </div>
            </div>
          )}

          {step === "completed" && (
            <div className="py-4 space-y-5 text-center">
              <div className="size-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Extraction Completed Successfully!</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Identified 14 core factors including Company Index, Target ICP, Job Titles, and B2B Offer metrics with 96% confidence.
                </p>
              </div>

              <div className="p-3 bg-[#14233a] rounded-xl border border-border/60 text-left text-xs space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Found Target ICP:</span>
                  <span className="font-semibold text-white">Founders, CXO, VP Sales</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extracted Domain:</span>
                  <span className="font-semibold text-white">B2B Lead Generation</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Completion:</span>
                  <span className="font-semibold text-emerald-400">100% (14 / 14)</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <Button
                  size="sm"
                  onClick={handleApplyData}
                  className="w-full h-10 bg-[#2B7CFF] hover:bg-[#2563eb] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-[#2B7CFF]/20"
                >
                  <Sparkles className="size-3.5" />
                  <span>Apply Extracted Data to Profile</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
