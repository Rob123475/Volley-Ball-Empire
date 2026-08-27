import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  FolderOpen,
  Home,
  XCircle,
  X,
} from "lucide-react";
import { RetireModal } from "./RetireModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CareerOptionsMenu({ isOpen, onClose }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showEndCareer, setShowEndCareer] = useState(false);

  if (!isOpen && !showEndCareer) return null;

  const handleSave = () => {
    toast({
      title: "Progress auto-saved",
      description: "Your career saves automatically after every action — you're always up to date.",
    });
    onClose();
  };

  const handleLoadDifferent = () => {
    navigate("/career");
    onClose();
  };

  const handleReturnToMain = () => {
    navigate("/career");
    onClose();
  };

  const MENU_ITEMS = [
    {
      label: "Save Career",
      desc: "Progress saves automatically",
      icon: Save,
      iconColour: "text-emerald-400",
      hoverBg: "hover:bg-emerald-500/8",
      onClick: handleSave,
    },
    {
      label: "Load Different Career",
      desc: "Switch to another save slot",
      icon: FolderOpen,
      iconColour: "text-sky-400",
      hoverBg: "hover:bg-sky-500/8",
      onClick: handleLoadDifferent,
    },
    {
      label: "Return to Main Menu",
      desc: "Go to career selection screen",
      icon: Home,
      iconColour: "text-violet-400",
      hoverBg: "hover:bg-violet-500/8",
      onClick: handleReturnToMain,
    },
  ];

  return (
    <>
      {/* Backdrop — only when menu is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Menu panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xs rounded-2xl border border-white/10 bg-slate-900/97 shadow-2xl backdrop-blur-xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Career Options</h2>
                <p className="text-[10px] text-white/35 mt-0.5">Active career management</p>
              </div>
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/12 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Standard items */}
            <div className="p-2.5 space-y-0.5">
              {MENU_ITEMS.map(({ label, desc, icon: Icon, iconColour, hoverBg, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all ${hoverBg}`}
                >
                  <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Icon className={`h-3.5 w-3.5 ${iconColour}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/80 leading-none">{label}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">{desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Divider + destructive End Career */}
            <div className="px-2.5 pb-2.5">
              <div className="h-px bg-white/8 mb-2.5" />
              <button
                onClick={() => setShowEndCareer(true)}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all hover:bg-orange-500/8"
              >
                <div className="h-7 w-7 rounded-lg bg-orange-500/12 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <XCircle className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-orange-400 leading-none">End Career</div>
                  <div className="text-[10px] text-orange-400/40 mt-0.5">Retire & save to Hall of Fame</div>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-white/5">
              <p className="text-[9px] text-white/18 text-center font-black uppercase tracking-widest">Beach Volley Pro</p>
            </div>
          </div>
        </div>
      )}

      {/* End Career modal — rendered outside the menu panel so it stacks above */}
      {showEndCareer && (
        <RetireModal
          onClose={() => setShowEndCareer(false)}
          onRetired={() => {
            setShowEndCareer(false);
            onClose();
            navigate("/career");
          }}
        />
      )}
    </>
  );
}
