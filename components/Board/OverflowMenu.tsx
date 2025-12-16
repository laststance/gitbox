/**
 * OverflowMenu Component
 *
 * PRD 4.1: Board/Maintenance共通のオーバーフローメニュー
 *
 * メニュー項目:
 * - Open on GitHub
 * - Open Production URL
 * - Open Tracking dashboard
 * - Open Supabase dashboard
 * - Edit Project Info…
 * - Move to Maintenance (Board only)
 * - Restore to Board (Maintenance only)
 */

"use client";

import React, { memo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Github,
  ExternalLink,
  BarChart2,
  Database,
  Edit,
  Archive,
  RotateCcw,
} from "lucide-react";

interface OverflowMenuProps {
  cardId: string;
  repoOwner?: string;
  repoName?: string;
  productionUrl?: string;
  trackingUrl?: string;
  supabaseUrl?: string;
  onEdit?: (id: string) => void;
  onMoveToMaintenance?: (id: string) => void;
  onRestoreToBoard?: (id: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Board or Maintenance context */
  context?: 'board' | 'maintenance';
}

export const OverflowMenu = memo<OverflowMenuProps>(
  ({
    cardId,
    repoOwner,
    repoName,
    productionUrl,
    trackingUrl,
    supabaseUrl,
    onEdit,
    onMoveToMaintenance,
    onRestoreToBoard,
    open,
    onOpenChange,
    context = 'board',
  }) => {
    const githubUrl = repoOwner && repoName
      ? `https://github.com/${repoOwner}/${repoName}`
      : null;

    const handleOpenUrl = (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger
          className="p-1 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          data-testid={`overflow-menu-trigger-${cardId}`}
        >
          <MoreVertical className="w-4 h-4" />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          data-testid="overflow-menu"
        >
          {/* Open on GitHub */}
          {githubUrl && (
            <DropdownMenuItem
              onClick={() => handleOpenUrl(githubUrl)}
              data-testid={`open-github-${cardId}`}
            >
              <Github className="w-4 h-4 mr-2" />
              Open on GitHub
            </DropdownMenuItem>
          )}

          {/* Open Production URL */}
          {productionUrl && (
            <DropdownMenuItem
              onClick={() => handleOpenUrl(productionUrl)}
              data-testid={`open-production-${cardId}`}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Production URL
            </DropdownMenuItem>
          )}

          {/* Open Tracking dashboard */}
          {trackingUrl && (
            <DropdownMenuItem
              onClick={() => handleOpenUrl(trackingUrl)}
              data-testid={`open-tracking-${cardId}`}
            >
              <BarChart2 className="w-4 h-4 mr-2" />
              Open Tracking dashboard
            </DropdownMenuItem>
          )}

          {/* Open Supabase dashboard */}
          {supabaseUrl && (
            <DropdownMenuItem
              onClick={() => handleOpenUrl(supabaseUrl)}
              data-testid={`open-supabase-${cardId}`}
            >
              <Database className="w-4 h-4 mr-2" />
              Open Supabase dashboard
            </DropdownMenuItem>
          )}

          {/* Separator before actions */}
          {(githubUrl || productionUrl || trackingUrl || supabaseUrl) &&
            (onEdit || onMoveToMaintenance || onRestoreToBoard) && (
              <DropdownMenuSeparator />
            )}

          {/* Edit Project Info */}
          {onEdit && (
            <DropdownMenuItem
              onClick={() => onEdit(cardId)}
              data-testid={`edit-project-${cardId}`}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Project Info…
            </DropdownMenuItem>
          )}

          {/* Move to Maintenance (Board context only) */}
          {context === 'board' && onMoveToMaintenance && (
            <DropdownMenuItem
              onClick={() => onMoveToMaintenance(cardId)}
              data-testid={`move-to-maintenance-${cardId}`}
            >
              <Archive className="w-4 h-4 mr-2" />
              Move to Maintenance
            </DropdownMenuItem>
          )}

          {/* Restore to Board (Maintenance context only) */}
          {context === 'maintenance' && onRestoreToBoard && (
            <DropdownMenuItem
              onClick={() => onRestoreToBoard(cardId)}
              data-testid={`restore-to-board-${cardId}`}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restore to Board
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

OverflowMenu.displayName = "OverflowMenu";

export default OverflowMenu;
