"use client";

import { FolderLock, MoreVertical, PencilLine, Plus, Search, Share2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/dialogs/share-dialog";
import {
  COLLECTION_CARD_CLASS,
  COLLECTION_GRID_CLASS,
  COLLECTION_LIST_CLASS,
  COLLECTION_ROW_CLASS,
  LayoutToggle,
} from "@/components/layout/layout-toggle";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  useCreateDataRoom,
  useDataRooms,
  useDeleteDataRoom,
  useUpdateDataRoom,
} from "@/hooks/use-data-rooms";
import type { ShareSubject } from "@/hooks/use-shares";
import { ApiError } from "@/lib/api-client";
import { formatBytes, formatCount, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useExplorerLayout } from "@/hooks/use-explorer-layout";
import type { DataRoomDto } from "@/types/dto";

export function DataRoomsPage() {
  const t = useTranslations("rooms");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dataRooms = useDataRooms();
  const { layout, setLayout } = useExplorerLayout();
  const createRoom = useCreateDataRoom();
  const updateRoom = useUpdateDataRoom();
  const deleteRoom = useDeleteDataRoom();

  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roomToEdit, setRoomToEdit] = useState<DataRoomDto | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<DataRoomDto | null>(null);
  const [roomToShare, setRoomToShare] = useState<ShareSubject | null>(null);

  const filteredRooms = useMemo(() => {
    const rooms = dataRooms.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rooms;
    return rooms.filter(
      (room) =>
        room.name.toLowerCase().includes(needle) ||
        (room.description?.toLowerCase().includes(needle) ?? false),
    );
  }, [dataRooms.data, query]);

  const openCreate = () => {
    setName("");
    setDescription("");
    setFormError(null);
    setRoomToEdit(null);
    setIsCreateOpen(true);
  };

  const openEdit = (room: DataRoomDto) => {
    setRoomToEdit(room);
    setName(room.name);
    setDescription(room.description ?? "");
    setFormError(null);
    setIsCreateOpen(false);
  };

  const closeForm = () => {
    setIsCreateOpen(false);
    setRoomToEdit(null);
    setFormError(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError(t("nameRequired"));
      return;
    }

    if (roomToEdit) {
      updateRoom.mutate(
        {
          id: roomToEdit.id,
          name: trimmed,
          description: description.trim() || null,
        },
        {
          onSuccess: (room) => {
            closeForm();
            toast.success(t("updatedToast", { name: room.name }));
          },
          onError: (error) =>
            setFormError(
              error instanceof ApiError ? error.message : t("updateError"),
            ),
        },
      );
      return;
    }

    createRoom.mutate(
      { name: trimmed, description: description.trim() || undefined },
      {
        onSuccess: (room) => {
          closeForm();
          setName("");
          setDescription("");
          toast.success(t("createdToast", { name: room.name }));
        },
        onError: (error) =>
          setFormError(
            error instanceof ApiError ? error.message : t("createError"),
          ),
      },
    );
  };

  const isSaving = createRoom.isPending || updateRoom.isPending;
  const formOpen = isCreateOpen || Boolean(roomToEdit);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          {t("newDataRoom")}
        </Button>
      </header>

      {!dataRooms.isPending && !dataRooms.isError && (dataRooms.data?.length ?? 0) > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 max-w-md">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchAria")}
              className="pl-9 pr-9"
            />
            {query ? (
              <button
                type="button"
                aria-label={tc("clearSearch")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xs p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setQuery("")}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <LayoutToggle layout={layout} onLayoutChange={setLayout} />
        </div>
      ) : null}

      {dataRooms.isPending ? (
        <>
          <Skeleton className="mb-4 h-9 max-w-md" />
          {layout === "grid" ? (
            <div className={COLLECTION_GRID_CLASS}>
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-44 w-[13.5rem] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}
        </>
      ) : dataRooms.isError ? (
        <ErrorState
          message={t("loadError")}
          onRetry={() => void dataRooms.refetch()}
        />
      ) : dataRooms.data.length === 0 ? (
        <EmptyState
          icon={<FolderLock />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus />
              {t("newDataRoom")}
            </Button>
          }
          className="border border-dashed border-border"
        />
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={t("noMatchTitle")}
          description={t("noMatchDescription", { query: query.trim() })}
          action={
            <Button size="sm" variant="secondary" onClick={() => setQuery("")}>
              {tc("clearSearch")}
            </Button>
          }
          className="border border-dashed border-border"
        />
      ) : layout === "grid" ? (
        <ul className={COLLECTION_GRID_CLASS}>
          {filteredRooms.map((room) => (
            <li key={room.id} className={cn("group", COLLECTION_CARD_CLASS)}>
              <Link href={`/rooms/${room.id}/folders/${room.rootFolderId}`} className="flex min-h-0 flex-1 flex-col">
                <span className="mb-3 flex size-11 items-center justify-center rounded-sm bg-accent text-accent-foreground">
                  <FolderLock className="size-5" aria-hidden />
                </span>
                <span
                  title={room.name}
                  className="line-clamp-2 min-h-[2.5rem] pr-6 break-all text-sm font-medium leading-5 text-foreground"
                >
                  {room.name}
                </span>
                {room.description ? (
                  <span title={room.description} className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {room.description}
                  </span>
                ) : null}
                <span className="mt-auto pt-2 text-xs text-muted-foreground">
                  {formatCount(room.fileCount, tc("file_one"), tc("file_other"), locale)} ·{" "}
                  {formatBytes(room.totalSize)}
                  <span className="block truncate">
                    {tc("updated", { time: formatRelativeTime(room.updatedAt, locale) })}
                  </span>
                </span>
              </Link>
              <div className="absolute right-3 top-3">
                <RoomActions
                  room={room}
                  onShare={setRoomToShare}
                  onEdit={openEdit}
                  onDelete={setRoomToDelete}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={COLLECTION_LIST_CLASS}>
          {filteredRooms.map((room) => (
            <li key={room.id} className={cn("group", COLLECTION_ROW_CLASS)}>
              <Link href={`/rooms/${room.id}/folders/${room.rootFolderId}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-foreground">
                  <FolderLock className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{room.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {room.description ||
                      `${formatCount(room.fileCount, tc("file_one"), tc("file_other"), locale)} · ${formatBytes(room.totalSize)}`}
                  </span>
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {formatRelativeTime(room.updatedAt, locale)}
                </span>
              </Link>
              <RoomActions
                room={room}
                onShare={setRoomToShare}
                onEdit={openEdit}
                onDelete={setRoomToDelete}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader
            title={roomToEdit ? t("editDataRoom") : t("newDataRoom")}
            description={roomToEdit ? t("editDescription") : t("newDescription")}
          />
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={tc("name")} htmlFor="room-name" error={formError ?? undefined}>
              <Input
                id="room-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("namePlaceholder")}
                autoFocus
                maxLength={255}
              />
            </Field>
            <Field label={tc("description")} htmlFor="room-description" hint={tc("optional")}>
              <Input
                id="room-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("descriptionPlaceholder")}
                maxLength={500}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeForm}>
                {tc("cancel")}
              </Button>
              <Button type="submit" isLoading={isSaving}>
                {roomToEdit ? tc("save") : tc("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(roomToDelete)}
        onOpenChange={(open) => !open && setRoomToDelete(null)}
        title={t("deleteTitle", { name: roomToDelete?.name ?? "" })}
        description={
          roomToDelete
            ? t("deleteDescription", {
                count: formatCount(
                  roomToDelete.fileCount,
                  tc("file_one"),
                  tc("file_other"),
                  locale,
                ),
              })
            : undefined
        }
        confirmLabel={t("deleteDataRoom")}
        variant="destructive"
        isLoading={deleteRoom.isPending}
        onConfirm={() => {
          if (!roomToDelete) return;
          const roomName = roomToDelete.name;
          deleteRoom.mutate(roomToDelete.id, {
            onSuccess: () => {
              setRoomToDelete(null);
              toast.success(t("deletedToast", { name: roomName }));
            },
            onError: () => toast.error(t("deleteErrorToast", { name: roomName })),
          });
        }}
      />

      <ShareDialog
        subject={roomToShare}
        onOpenChange={(open) => !open && setRoomToShare(null)}
      />
    </div>
  );
}

function RoomActions({
  room,
  onShare,
  onEdit,
  onDelete,
}: {
  room: DataRoomDto;
  onShare: (subject: ShareSubject) => void;
  onEdit: (room: DataRoomDto) => void;
  onDelete: (room: DataRoomDto) => void;
}) {
  const t = useTranslations("rooms");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={t("actionsFor", { name: room.name })}
          className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => onShare({ type: "DATA_ROOM", id: room.id, name: room.name })}
        >
          <Share2 />
          {t("share")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit(room)}>
          <PencilLine />
          {t("renameEdit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(room)}>
          <Trash2 />
          {t("deleteDataRoom")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
