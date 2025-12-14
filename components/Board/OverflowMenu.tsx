"use client";

import React, { memo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Archive } from "lucide-react";

interface OverflowMenuProps {
  cardId: string;
  onEdit?: (id: string) => void;
  onMoveToMaintenance?: (id: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const OverflowMenu = memo<OverflowMenuProps>(
  ({ cardId, onEdit, onMoveToMaintenance, open, onOpenChange }) => {
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
          className="w-48"
          data-testid="overflow-menu"
        >
          {onEdit && (
            <DropdownMenuItem
              onClick={() => onEdit(cardId)}
              data-testid={`edit-project-${cardId}`}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Project Info
            </DropdownMenuItem>
          )}
          {onMoveToMaintenance && (
            <DropdownMenuItem
              onClick={() => onMoveToMaintenance(cardId)}
              data-testid={`move-to-maintenance-${cardId}`}
            >
              <Archive className="w-4 h-4 mr-2" />
              Move to Maintenance
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

OverflowMenu.displayName = "OverflowMenu";

export default OverflowMenu;
