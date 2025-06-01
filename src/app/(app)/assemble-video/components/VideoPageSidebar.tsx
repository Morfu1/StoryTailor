"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
// import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"; // Unused imports
import { ArrowLeft, SidebarClose, LucideIcon } from "lucide-react";

interface SidebarNavItem {
  name: string;
  icon: LucideIcon;
  sectionBreak?: boolean;
}

interface VideoPageSidebarProps {
  selectedPanel: string;
  setSelectedPanel: (panel: string) => void;
  isSidebarOpen: boolean; // This prop might not be needed if sidebar is always open in this component
  setIsSidebarOpen: (isOpen: boolean) => void;
  storyId: string | null;
  sidebarNavItems: SidebarNavItem[];
}

export default function VideoPageSidebar({
  selectedPanel,
  setSelectedPanel,
  setIsSidebarOpen,
  storyId,
  sidebarNavItems,
}: VideoPageSidebarProps) {
  return (
    <div className="w-52 bg-background border-r border-border flex flex-col h-full">
      <div className="p-3 border-b border-border flex justify-between items-center">
        <Link
          href={`/create-story?storyId=${storyId}`}
          className="flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Story Editor
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden" // Assuming this class handles responsive toggle
        >
          <SidebarClose className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col h-full">
        <div className="p-2">
          {sidebarNavItems.map((item, index) => (
            <React.Fragment key={index}>
              {item.sectionBreak && <hr className="my-2 border-border" />}
              <Button
                variant="ghost"
                className={`w-full justify-start ${selectedPanel === item.name ? "bg-accent/20 text-foreground" : "text-muted-foreground"} hover:text-foreground hover:bg-accent/10`}
                onClick={() => setSelectedPanel(item.name)}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Button>
            </React.Fragment>
          ))}
        </div>

      </div>
    </div>
  );
}