/**
 * Board Page Client Component
 *
 * Constitution要件:
 * - Principle V: セキュリティファースト
 * - Principle VI: TDD - テストファースト
 *
 * User Story 4:
 * - Project Info modalの統合
 * - Optimistic UI updates
 *
 * PRD 3.2:
 * - StatusList CRUD操作
 */

'use client';

import { useState, useCallback } from 'react';
import { KanbanBoard } from '@/components/Board/KanbanBoard';
import { ProjectInfoModal, ProjectInfo } from '@/components/Modals/ProjectInfoModal';
import { StatusListDialog } from '@/components/Modals/StatusListDialog';
import { getProjectInfo, upsertProjectInfo, ProjectInfoData } from '@/lib/actions/project-info';
import {
  createStatusList,
  updateStatusList,
  deleteStatusList,
} from '@/lib/actions/board';
import { useAppDispatch, useAppSelector } from '@/lib/redux/store';
import { setStatusLists, selectStatusLists } from '@/lib/redux/slices/boardSlice';
import type { StatusListDomain } from '@/lib/models/domain';
import { Plus, FolderGit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddRepositoryCombobox } from '@/components/Board/AddRepositoryCombobox';

interface BoardPageClientProps {
  boardId: string;
  boardName: string;
}

export function BoardPageClient({ boardId, boardName }: BoardPageClientProps) {
  const dispatch = useAppDispatch();
  const statusLists = useAppSelector(selectStatusLists);

  // Project Info Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // StatusList Dialog state
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<StatusListDomain | null>(null);
  const [statusDialogMode, setStatusDialogMode] = useState<'create' | 'edit'>('create');

  /**
   * Project Info モーダルを開く
   * Constitution要件: Principle VI - TDD
   */
  const handleEditProjectInfo = useCallback(async (cardId: string) => {
    setSelectedCardId(cardId);
    setIsLoading(true);

    try {
      // Project Info取得
      const data = await getProjectInfo(cardId);
      setProjectInfo({
        id: cardId,
        quickNote: data?.quickNote || '',
        links: data?.links || [],
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error('Failed to load project info:', error);
      // エラーの場合も空の状態でモーダルを開く
      setProjectInfo({
        id: cardId,
        quickNote: '',
        links: [],
      });
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Project Info保存（Optimistic Update）
   * Constitution要件: Principle V - セキュリティファースト
   * T069: Optimistic updates実装
   */
  const handleSaveProjectInfo = useCallback(
    async (data: ProjectInfoData) => {
      if (!selectedCardId) return;

      // Optimistic Update: UIを即座に更新
      setProjectInfo((prev) =>
        prev
          ? {
              ...prev,
              quickNote: data.quickNote,
              links: data.links,
            }
          : null
      );

      try {
        // バックエンド保存（非同期）
        await upsertProjectInfo(selectedCardId, data);

        // TODO: Redux stateも更新（Phase 6で実装）
        // dispatch(updateProjectInfo({ cardId: selectedCardId, data }));
      } catch (error) {
        console.error('Failed to save project info:', error);

        // エラー時はロールバック
        try {
          const rollbackData = await getProjectInfo(selectedCardId);
          setProjectInfo({
            id: selectedCardId,
            quickNote: rollbackData?.quickNote || '',
            links: rollbackData?.links || [],
          });
        } catch (rollbackError) {
          console.error('Failed to rollback:', rollbackError);
        }

        // ユーザーにエラー通知
        // TODO: Toast notification (Phase 6で実装)
        alert('Failed to save project information. Please try again.');
      }
    },
    [selectedCardId]
  );

  /**
   * モーダルを閉じる
   */
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCardId(null);
    setProjectInfo(null);
  }, []);

  /**
   * Maintenance Modeへ移動
   * User Story 6で実装予定
   */
  const handleMoveToMaintenance = useCallback((cardId: string) => {
    // TODO: Maintenance Modeへ移動 (User Story 6で実装)
    console.log('Move to Maintenance:', cardId);
  }, []);

  // ========================================
  // StatusList CRUD handlers
  // ========================================

  /**
   * StatusList追加ダイアログを開く
   */
  const handleOpenAddStatus = useCallback(() => {
    setSelectedStatus(null);
    setStatusDialogMode('create');
    setIsStatusDialogOpen(true);
  }, []);

  /**
   * StatusList編集ダイアログを開く
   */
  const handleEditStatus = useCallback((status: StatusListDomain) => {
    setSelectedStatus(status);
    setStatusDialogMode('edit');
    setIsStatusDialogOpen(true);
  }, []);

  /**
   * StatusListを保存（作成/更新）
   */
  const handleSaveStatus = useCallback(
    async (data: { name: string; color: string; wipLimit: number | null }) => {
      if (statusDialogMode === 'create') {
        // 新規作成
        const newStatus = await createStatusList(
          boardId,
          data.name,
          data.color,
          data.wipLimit ?? undefined
        );
        // Redux更新
        dispatch(setStatusLists([...statusLists, newStatus]));
      } else if (selectedStatus) {
        // 更新
        await updateStatusList(selectedStatus.id, {
          name: data.name,
          color: data.color,
          wipLimit: data.wipLimit,
        });
        // Redux更新
        const updatedLists = statusLists.map((s) =>
          s.id === selectedStatus.id
            ? { ...s, title: data.name, color: data.color, wipLimit: data.wipLimit ?? 0 }
            : s
        );
        dispatch(setStatusLists(updatedLists));
      }
    },
    [boardId, dispatch, statusLists, statusDialogMode, selectedStatus]
  );

  /**
   * StatusListを削除
   */
  const handleDeleteStatus = useCallback(
    async (statusId: string) => {
      const targetStatus = statusLists.find((s) => s.id === statusId);
      if (!targetStatus) return;

      // 確認ダイアログ
      const confirmed = window.confirm(
        `Are you sure you want to delete "${targetStatus.title}"? This action cannot be undone.`
      );
      if (!confirmed) return;

      try {
        await deleteStatusList(statusId, boardId);
        // Redux更新
        const filteredLists = statusLists.filter((s) => s.id !== statusId);
        dispatch(setStatusLists(filteredLists));
      } catch (error) {
        console.error('Failed to delete status list:', error);
        alert('Failed to delete column. Please try again.');
      }
    },
    [boardId, dispatch, statusLists]
  );

  /**
   * カード追加（将来実装）
   */
  const handleAddCard = useCallback((statusId: string) => {
    // TODO: AddRepositoryComboboxを開く
    console.log('Add card to status:', statusId);
  }, []);

  return (
    <>
      <main className="flex h-screen flex-col">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {boardName}
            </h1>

            {/* ボード操作ボタン */}
            <div className="flex items-center gap-2">
              {/* Add Repositories - PRD 3.1 */}
              <AddRepositoryCombobox
                boardId={boardId}
                statusId={statusLists[0]?.id || ''} // 最初の列に追加（なければ空文字）
                onRepositoriesAdded={() => {
                  // TODO: ボードを再読み込み
                  window.location.reload();
                }}
                onQuickNoteFocus={() => {
                  // TODO: Quick noteフィールドにフォーカス
                  console.log('Focus quick note');
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddStatus}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Column
              </Button>
              <Button
                variant="outline"
                size="sm"
              >
                Board Settings
              </Button>
            </div>
          </div>
        </header>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
          <KanbanBoard
            boardId={boardId}
            onEditProjectInfo={handleEditProjectInfo}
            onMoveToMaintenance={handleMoveToMaintenance}
            onEditStatus={handleEditStatus}
            onDeleteStatus={handleDeleteStatus}
            onAddCard={handleAddCard}
          />
        </div>
      </main>

      {/* Project Info Modal */}
      {projectInfo && (
        <ProjectInfoModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveProjectInfo}
          projectInfo={projectInfo}
        />
      )}

      {/* StatusList Dialog */}
      <StatusListDialog
        isOpen={isStatusDialogOpen}
        onClose={() => setIsStatusDialogOpen(false)}
        onSave={handleSaveStatus}
        statusList={selectedStatus}
        mode={statusDialogMode}
      />
    </>
  );
}
