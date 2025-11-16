"use client";

import React, { useState, useEffect, memo } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  UniqueIdentifier,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { StatusColumn } from "./StatusColumn";
import type { RepoCard as RepoCardType } from "./RepoCard";

// Types
interface RepoCard {
  id: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  assignee?: {
    name: string;
    avatar: string;
  };
  tags?: string[];
  dueDate?: string;
  attachments?: number;
  comments?: number;
  statusId: string;
}

interface StatusList {
  id: string;
  title: string;
  wipLimit: number;
  color?: string;
  order: number;
}

interface KanbanBoardProps {
  boardId?: string;
  onEditProjectInfo?: (cardId: string) => void;
  onMoveToMaintenance?: (cardId: string) => void;
}

// Loading Skeleton Component
const KanbanSkeleton = memo(() => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, colIndex) => (
        <div
          key={colIndex}
          className="bg-background/50 backdrop-blur-sm rounded-xl p-4 border border-border"
        >
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-12" />
          </div>
          <div className="space-y-3">
            {[...Array(2)].map((_, cardIndex) => (
              <motion.div
                key={cardIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cardIndex * 0.1 }}
              >
                <Skeleton className="h-32 w-full rounded-lg" />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
KanbanSkeleton.displayName = "KanbanSkeleton";

// Error State Component
const ErrorState = memo(({ message }: { message: string }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <AlertCircle className="w-16 h-16 text-destructive mb-4" />
      <h3 className="text-xl font-semibold text-foreground mb-2">
        Something went wrong
      </h3>
      <p className="text-muted-foreground text-center max-w-md">{message}</p>
    </div>
  );
});
ErrorState.displayName = "ErrorState";


// Main Kanban Board Component
export const KanbanBoard = memo<KanbanBoardProps>(
  ({ boardId = "default-board", onEditProjectInfo, onMoveToMaintenance }) => {
    const [statuses, setStatuses] = useState<StatusList[]>([]);
    const [cards, setCards] = useState<RepoCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

    const sensors = useSensors(
      useSensor(MouseSensor, {
        activationConstraint: {
          distance: 8,
        },
      }),
      useSensor(TouchSensor, {
        activationConstraint: {
          delay: 200,
          tolerance: 6,
        },
      }),
      useSensor(KeyboardSensor)
    );

    // TODO: Replace with Supabase integration
    useEffect(() => {
      const fetchData = async () => {
        try {
          setLoading(true);
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const mockStatuses: StatusList[] = [
            {
              id: "backlog",
              title: "Backlog",
              wipLimit: 10,
              color: "#8B7355",
              order: 0,
            },
            {
              id: "todo",
              title: "Todo",
              wipLimit: 5,
              color: "#6B8E23",
              order: 1,
            },
            {
              id: "in-progress",
              title: "In Progress",
              wipLimit: 3,
              color: "#CD853F",
              order: 2,
            },
            {
              id: "review",
              title: "Review",
              wipLimit: 4,
              color: "#4682B4",
              order: 3,
            },
            {
              id: "done",
              title: "Done",
              wipLimit: 20,
              color: "#556B2F",
              order: 4,
            },
          ];

          const mockCards: RepoCard[] = [
            {
              id: "1",
              title: "vibe-rush",
              description: "GitHub Repository Manager",
              priority: "high",
              assignee: {
                name: "Ryota Murakami",
                avatar: "/placeholder.svg",
              },
              tags: ["Next.js", "TypeScript"],
              dueDate: "2024-01-15",
              attachments: 3,
              comments: 7,
              statusId: "in-progress",
            },
          ];

          setStatuses(mockStatuses);
          setCards(mockCards);
          setError(null);
        } catch (err) {
          setError("Failed to load board data. Please try again later.");
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }, [boardId]);

    const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const activeCard = cards.find((c) => c.id === active.id);
      if (!activeCard) return;

      const overStatusId = over.id as string;
      const overCard = cards.find((c) => c.id === over.id);
      const targetStatusId = overCard ? overCard.statusId : overStatusId;

      if (activeCard.statusId === targetStatusId) {
        const columnCards = cards.filter((c) => c.statusId === targetStatusId);
        const oldIndex = columnCards.findIndex((c) => c.id === active.id);
        const newIndex = columnCards.findIndex((c) => c.id === over.id);

        if (oldIndex !== newIndex) {
          const reordered = arrayMove(columnCards, oldIndex, newIndex);
          const otherCards = cards.filter((c) => c.statusId !== targetStatusId);
          setCards([...otherCards, ...reordered]);
        }
      } else {
        setCards((prev) =>
          prev.map((c) =>
            c.id === activeCard.id ? { ...c, statusId: targetStatusId } : c
          )
        );
      }
    };

    if (loading) {
      return (
        <div className="w-full p-6">
          <KanbanSkeleton />
        </div>
      );
    }

    if (error) {
      return (
        <div className="w-full p-6">
          <ErrorState message={error} />
        </div>
      );
    }

    const activeCard = cards.find((c) => c.id === activeId);

    return (
      <div className="w-full h-full p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToParentElement]}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statuses
              .sort((a, b) => a.order - b.order)
              .map((status) => (
                <StatusColumn
                  key={status.id}
                  status={status}
                  cards={cards.filter((c) => c.statusId === status.id)}
                  onEdit={onEditProjectInfo}
                  onMaintenance={onMoveToMaintenance}
                />
              ))}
          </div>

          <DragOverlay>
            {activeCard ? (
              <Card className="cursor-grabbing shadow-2xl rotate-3 opacity-90">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-foreground">
                    {activeCard.title}
                  </h4>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    );
  }
);
KanbanBoard.displayName = "KanbanBoard";

export default KanbanBoard;
