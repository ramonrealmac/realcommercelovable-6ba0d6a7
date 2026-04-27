import { X } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

const TabBar = () => {
  const { XTabs, XActiveTabId, setActiveTab, closeTab } = useAppContext();

  if (XTabs.length === 0) return null;

  return (
    <div className="flex items-center bg-secondary border-b border-border h-8 overflow-x-auto shrink-0">
      {XTabs.map(tab => (
        <div
          key={tab.id}
          className={`flex items-center gap-1 px-3 py-1 text-sm cursor-pointer border-r border-border whitespace-nowrap select-none ${
            tab.id === XActiveTabId
              ? "bg-card text-foreground font-medium"
              : "bg-secondary text-muted-foreground hover:bg-accent"
          }`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span>{tab.title}</span>
          <button
            className="ml-1 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default TabBar;
