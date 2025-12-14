"use client";

import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { RepoCard } from "./RepoCard";
import type { StatusListDomain, RepoCardDomain, RepoCardForRedux } from "@/lib/models/domain";

// Types: Using Domain types for type-safe state management
interface StatusColumnProps {
  status: StatusListDomain;
  cards: RepoCardForRedux[];
  onEdit?: (id: string) => void;
  onMaintenance?: (id: string) => void;
}

export const StatusColumn = memo<StatusColumnProps>(
  ({ status, cards, onEdit, onMaintenance }) => {
    const cardIds = cards.map((c) => c.id);
    const isOverLimit = cards.length > status.wipLimit;

    return (
      <div
        className="flex flex-col h-full min-w-[280px] bg-background/50 backdrop-blur-sm rounded-xl p-4 border border-border"
        data-testid={`status-column-${status.id}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {status.color && (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: status.color }}
              />
            )}
            <h3 className="font-semibold text-foreground">{status.title}</h3>
          </div>
          <Badge
            variant={isOverLimit ? "destructive" : "secondary"}
            className="text-xs"
            data-testid="wip-limit-badge"
          >
            WIP {cards.length}/{status.wipLimit}
          </Badge>
        </div>

        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 flex-1 overflow-y-auto">
            <AnimatePresence>
              {cards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <RepoCard
                    card={card}
                    onEdit={onEdit}
                    onMaintenance={onMaintenance}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>

        {isOverLimit && (
          <div
            className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md"
            data-testid="wip-limit-warning"
          >
            <p className="text-xs text-destructive font-medium">
              ⚠️ WIP limit exceeded
            </p>
          </div>
        )}
      </div>
    );
  }
);

StatusColumn.displayName = "StatusColumn";

export default StatusColumn;
