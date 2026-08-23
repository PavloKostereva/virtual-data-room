import { Role, ShareSubjectType } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import {
  changePasswordSchema,
  createDataRoomSchema,
  createFolderSchema,
  createShareSchema,
  finalizeUploadSchema,
  forgotPasswordSchema,
  listQuerySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  searchQuerySchema,
  shareSubjectSchema,
  toggleStarSchema,
  restoreTrashSchema,
  updateDataRoomSchema,
  updateFileSchema,
  updateFolderSchema,
  uploadTicketSchema,
} from "@/lib/validation";
import { badRequest } from "@/server/errors";
import { createRequestContext, requireUser } from "@/server/http/context";
import { defineRoute, parseBody, parseQuery, toErrorResponse } from "@/server/http/route";
import {
  changePassword,
  getCurrentUser,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
} from "@/server/services/auth.service";
import {
  createDataRoom,
  deleteDataRoom,
  getDataRoom,
  listOwnedDataRooms,
  renameDataRoom,
} from "@/server/services/dataroom.service";
import {
  createUploadTicket,
  deleteFile,
  finalizeUpload,
  getFileContentUrl,
  getFileDetail,
  moveFile,
  renameFile,
} from "@/server/services/file.service";
import {
  createFolder,
  deleteFolder,
  getFolderStats,
  getFolderTree,
  getFolderView,
  listChildren,
  moveFolder,
  renameFolder,
} from "@/server/services/folder.service";
import { runHealthChecks } from "@/server/health";
import { searchFolder } from "@/server/services/search.service";
import {
  addRecipients,
  createPublicLink,
  listSharedWithMe,
  listSharesForSubject,
  revokeGrant,
  revokeShare,
} from "@/server/services/share.service";
import { listStarredItems, toggleStar } from "@/server/services/star.service";
import {
  emptyTrash,
  listTrash,
  permanentlyDeleteTrashItem,
  restoreTrashItem,
} from "@/server/services/trash.service";
import {
  assertValidLocalStorageRequest,
  readLocalObject,
  writeLocalObject,
} from "@/server/storage/local-driver";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RouteHandler = (
  request: NextRequest,
  params: Record<string, string>,
) => Promise<Response>;

interface ApiRoute {
  method: Method;
  pattern: string;
  handle: RouteHandler;
}

const localStorageQuery = z.object({
  key: z.string().min(1),
  expiresAt: z.coerce.number().int().positive(),
  contentType: z.string().default(""),
  disposition: z.string().default(""),
  fileName: z.string().default(""),
  signature: z.string().min(1),
});

const fileContentQuery = z.object({
  disposition: z.enum(["inline", "attachment"]).default("inline"),
  versionId: z.string().optional(),
  shareToken: z.string().optional(),
});

function wrap<T extends Record<string, string>>(
  handler: (request: NextRequest, segment: { params: Promise<T> }) => Promise<Response>,
): RouteHandler {
  return (request, params) => handler(request, { params: Promise.resolve(params as T) });
}

function match(pattern: string, parts: readonly string[]): Record<string, string> | null {
  const segments = pattern === "" ? [] : pattern.split("/");
  if (segments.length !== parts.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const part = parts[index];
    if (!segment || part === undefined) return null;
    if (segment.startsWith(":")) {
      params[segment.slice(1)] = part;
      continue;
    }
    if (segment !== part) return null;
  }
  return params;
}

const ROUTES: ApiRoute[] = [
  {
    method: "GET",
    pattern: "health",
    handle: async () => {
      try {
        const report = await runHealthChecks();
        const status = report.status === "ok" || report.status === "degraded" ? 200 : 503;
        return NextResponse.json(report, { status });
      } catch (error) {
        return NextResponse.json(
          {
            status: "error",
            message: error instanceof Error ? error.message : "Health check failed.",
            hint: "The app could not start env validation. Check Vercel build logs for missing variables.",
          },
          { status: 503 },
        );
      }
    },
  },
  {
    method: "POST",
    pattern: "auth/login",
    handle: async (request) => {
      try {
        const { supabase, applyCookies } = createSupabaseRouteClient(request);
        const input = await parseBody(request, loginSchema);
        const user = await login(supabase, input);
        return applyCookies(NextResponse.json({ user }));
      } catch (error) {
        return toErrorResponse(error);
      }
    },
  },
  {
    method: "POST",
    pattern: "auth/logout",
    handle: async (request) => {
      try {
        const { supabase, applyCookies } = createSupabaseRouteClient(request);
        await logout(supabase);
        return applyCookies(NextResponse.json({ ok: true }));
      } catch (error) {
        return toErrorResponse(error);
      }
    },
  },
  {
    method: "POST",
    pattern: "auth/register",
    handle: wrap(
      defineRoute(async ({ request }) => {
        const input = await parseBody(request, registerSchema);
        return { user: await register(input) };
      }),
    ),
  },
  {
    method: "GET",
    pattern: "auth/me",
    handle: wrap(
      defineRoute(async ({ context }) => {
        if (!context.user) return { user: null };
        return { user: await getCurrentUser(context.user.id) };
      }),
    ),
  },
  {
    method: "POST",
    pattern: "auth/forgot-password",
    handle: wrap(
      defineRoute(async ({ request }) => {
        const input = await parseBody(request, forgotPasswordSchema);
        return requestPasswordReset(input.email);
      }),
    ),
  },
  {
    method: "POST",
    pattern: "auth/reset-password",
    handle: wrap(
      defineRoute(async ({ request }) => {
        const input = await parseBody(request, resetPasswordSchema);
        return resetPassword(input);
      }),
    ),
  },
  {
    method: "POST",
    pattern: "auth/change-password",
    handle: async (request) => {
      try {
        const { supabase, applyCookies } = createSupabaseRouteClient(request);
        const context = await createRequestContext(request);
        const user = requireUser(context);
        const input = await parseBody(request, changePasswordSchema);
        await changePassword(supabase, user, input);
        return applyCookies(NextResponse.json({ ok: true }));
      } catch (error) {
        return toErrorResponse(error);
      }
    },
  },
  {
    method: "GET",
    pattern: "data-rooms",
    handle: wrap(
      defineRoute(async ({ context }) => {
        const user = requireUser(context);
        return { dataRooms: await listOwnedDataRooms(user.id) };
      }),
    ),
  },
  {
    method: "POST",
    pattern: "data-rooms",
    handle: wrap(
      defineRoute(async ({ request, context }) => {
        const user = requireUser(context);
        const input = await parseBody(request, createDataRoomSchema);
        return { dataRoom: await createDataRoom(user.id, input) };
      }),
    ),
  },
  {
    method: "GET",
    pattern: "data-rooms/:roomId/tree",
    handle: wrap(
      defineRoute<{ roomId: string }>(async ({ context, params }) => ({
        folders: await getFolderTree(context, params.roomId),
      })),
    ),
  },
  {
    method: "GET",
    pattern: "data-rooms/:roomId",
    handle: wrap(
      defineRoute<{ roomId: string }>(async ({ context, params }) => ({
        dataRoom: await getDataRoom(context, params.roomId),
      })),
    ),
  },
  {
    method: "PATCH",
    pattern: "data-rooms/:roomId",
    handle: wrap(
      defineRoute<{ roomId: string }>(async ({ request, context, params }) => {
        const input = await parseBody(request, updateDataRoomSchema);
        return { dataRoom: await renameDataRoom(context, params.roomId, input) };
      }),
    ),
  },
  {
    method: "DELETE",
    pattern: "data-rooms/:roomId",
    handle: wrap(
      defineRoute<{ roomId: string }>(async ({ context, params }) => {
        await deleteDataRoom(context, params.roomId);
      }),
    ),
  },
  {
    method: "POST",
    pattern: "folders",
    handle: wrap(
      defineRoute(async ({ request, context }) => {
        const input = await parseBody(request, createFolderSchema);
        return { folder: await createFolder(context, input) };
      }),
    ),
  },
  {
    method: "GET",
    pattern: "folders/:folderId/children",
    handle: wrap(
      defineRoute<{ folderId: string }>(async ({ request, context, params }) => {
        const query = parseQuery(request, listQuerySchema);
        return listChildren(context, params.folderId, {
          sort: query.sort,
          direction: query.direction,
          limit: query.limit,
          cursor: query.cursor,
        });
      }),
    ),
  },
  {
    method: "GET",
    pattern: "folders/:folderId/stats",
    handle: wrap(
      defineRoute<{ folderId: string }>(async ({ context, params }) =>
        getFolderStats(context, params.folderId),
      ),
    ),
  },
  {
    method: "GET",
    pattern: "folders/:folderId/search",
    handle: wrap(
      defineRoute<{ folderId: string }>(async ({ request, context, params }) => {
        const query = parseQuery(request, searchQuerySchema);
        return {
          results: await searchFolder(context, params.folderId, {
            query: query.q,
            kind: query.kind,
            limit: query.limit,
          }),
        };
      }),
    ),
  },
  {
    method: "GET",
    pattern: "folders/:folderId",
    handle: wrap(
      defineRoute<{ folderId: string }>(async ({ context, params }) =>
        getFolderView(context, params.folderId),
      ),
    ),
  },
  {
    method: "PATCH",
    pattern: "folders/:folderId",
    handle: wrap(
      defineRoute<{ folderId: string }>(async ({ request, context, params }) => {
        const input = await parseBody(request, updateFolderSchema);
        let folder = undefined;
        if (input.parentId !== undefined) {
          folder = await moveFolder(context, params.folderId, input.parentId);
        }
        if (input.name !== undefined) {
          folder = await renameFolder(context, params.folderId, input.name);
        }
        return { folder };
      }),
    ),
  },
  {
    method: "DELETE",
    pattern: "folders/:folderId",
    handle: wrap(
      defineRoute<{ folderId: string }>(async ({ context, params }) => {
        await deleteFolder(context, params.folderId);
      }),
    ),
  },
  {
    method: "POST",
    pattern: "files/upload-ticket",
    handle: wrap(
      defineRoute(async ({ request, context }) => {
        const input = await parseBody(request, uploadTicketSchema);
        return { ticket: await createUploadTicket(context, input) };
      }),
    ),
  },
  {
    method: "POST",
    pattern: "files",
    handle: wrap(
      defineRoute(async ({ request, context }) => {
        const input = await parseBody(request, finalizeUploadSchema);
        return finalizeUpload(context, input);
      }),
    ),
  },
  {
    method: "GET",
    pattern: "files/:fileId/content",
    handle: wrap(
      defineRoute<{ fileId: string }>(async ({ request, context, params }) => {
        const query = parseQuery(request, fileContentQuery);
        const url = await getFileContentUrl(context, params.fileId, {
          disposition: query.disposition,
          versionId: query.versionId,
        });
        const target = /^https?:\/\//i.test(url)
          ? url
          : new URL(url, request.nextUrl.origin).toString();
        return NextResponse.redirect(target, {
          status: 302,
          headers: { "cache-control": "private, no-store" },
        });
      }),
    ),
  },
  {
    method: "GET",
    pattern: "files/:fileId",
    handle: wrap(
      defineRoute<{ fileId: string }>(async ({ context, params }) => ({
        file: await getFileDetail(context, params.fileId),
      })),
    ),
  },
  {
    method: "PATCH",
    pattern: "files/:fileId",
    handle: wrap(
      defineRoute<{ fileId: string }>(async ({ request, context, params }) => {
        const input = await parseBody(request, updateFileSchema);
        let file = undefined;
        if (input.folderId !== undefined) {
          file = await moveFile(context, params.fileId, input.folderId, input.conflictStrategy);
        }
        if (input.name !== undefined) {
          file = await renameFile(context, params.fileId, input.name, input.conflictStrategy);
        }
        return { file };
      }),
    ),
  },
  {
    method: "DELETE",
    pattern: "files/:fileId",
    handle: wrap(
      defineRoute<{ fileId: string }>(async ({ context, params }) => {
        await deleteFile(context, params.fileId);
      }),
    ),
  },
  {
    method: "GET",
    pattern: "shares",
    handle: wrap(
      defineRoute(async ({ request, context }) => {
        const query = parseQuery(request, shareSubjectSchema);
        return {
          shares: await listSharesForSubject(context, {
            type: ShareSubjectType[query.subjectType],
            id: query.subjectId,
          }),
        };
      }),
    ),
  },
  {
    method: "POST",
    pattern: "shares",
    handle: wrap(
      defineRoute(async ({ request, context }) => {
        const input = await parseBody(request, createShareSchema);
        const subject = { type: ShareSubjectType[input.subjectType], id: input.subjectId };
        if (input.mode === "PUBLIC_LINK") {
          return {
            share: await createPublicLink(context, subject, {
              expiresInDays: input.expiresInDays ?? null,
            }),
          };
        }
        if (!input.emails || input.emails.length === 0) {
          throw badRequest("Enter at least one email address.");
        }
        const role = input.role === "EDITOR" ? Role.EDITOR : Role.VIEWER;
        return { share: await addRecipients(context, subject, input.emails, role) };
      }),
    ),
  },
  {
    method: "DELETE",
    pattern: "shares/:shareId/grants/:grantId",
    handle: wrap(
      defineRoute<{ shareId: string; grantId: string }>(async ({ context, params }) => {
        await revokeGrant(context, params.grantId);
      }),
    ),
  },
  {
    method: "DELETE",
    pattern: "shares/:shareId",
    handle: wrap(
      defineRoute<{ shareId: string }>(async ({ context, params }) => {
        await revokeShare(context, params.shareId);
      }),
    ),
  },
  {
    method: "GET",
    pattern: "shared-with-me",
    handle: wrap(
      defineRoute(async ({ context }) => {
        requireUser(context);
        return { items: await listSharedWithMe(context) };
      }),
    ),
  },
  {
    method: "GET",
    pattern: "stars",
    handle: wrap(
      defineRoute(async ({ context }) => ({
        items: await listStarredItems(context),
      })),
    ),
  },
  {
    method: "POST",
    pattern: "stars",
    handle: wrap(
      defineRoute(async ({ request, context }) => {
        const input = await parseBody(request, toggleStarSchema);
        return toggleStar(context, { type: input.subjectType, id: input.subjectId });
      }),
    ),
  },
  {
    method: "GET",
    pattern: "trash",
    handle: wrap(
      defineRoute(async ({ context }) => ({
        items: await listTrash(context),
      })),
    ),
  },
  {
    method: "POST",
    pattern: "trash/restore",
    handle: wrap(
      defineRoute(async ({ request, context }) => {
        const input = await parseBody(request, restoreTrashSchema);
        return { item: await restoreTrashItem(context, input) };
      }),
    ),
  },
  {
    method: "POST",
    pattern: "trash/empty",
    handle: wrap(
      defineRoute(async ({ context }) => {
        await emptyTrash(context);
      }),
    ),
  },
  {
    method: "DELETE",
    pattern: "trash/:kind/:id",
    handle: wrap(
      defineRoute<{ kind: string; id: string }>(async ({ context, params }) => {
        if (params.kind !== "file" && params.kind !== "folder" && params.kind !== "dataRoom") {
          throw badRequest("Invalid trash item type.");
        }
        await permanentlyDeleteTrashItem(context, { kind: params.kind, id: params.id });
      }),
    ),
  },
  {
    method: "PUT",
    pattern: "storage/local",
    handle: wrap(
      defineRoute(async ({ request }) => {
        const query = parseQuery(request, localStorageQuery);
        assertValidLocalStorageRequest("put", query);
        if (!request.body) throw badRequest("The upload had no content.");
        await writeLocalObject(query.key, request.body);
        return new NextResponse(null, { status: 204 });
      }),
    ),
  },
  {
    method: "GET",
    pattern: "storage/local",
    handle: wrap(
      defineRoute(async ({ request }) => {
        const query = parseQuery(request, localStorageQuery);
        assertValidLocalStorageRequest("get", query);
        const object = await readLocalObject(query.key);
        const disposition = query.disposition === "attachment" ? "attachment" : "inline";
        return new NextResponse(object.stream as ReadableStream<Uint8Array>, {
          headers: {
            "content-type": query.contentType || "application/octet-stream",
            "content-length": String(object.size),
            "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(query.fileName)}`,
            "cache-control": "private, max-age=600",
          },
        });
      }),
    ),
  },
];

export async function dispatchApi(
  method: Method,
  request: NextRequest,
  path: readonly string[],
): Promise<Response> {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const params = match(route.pattern, path);
    if (!params) continue;
    return route.handle(request, params);
  }

  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: "This endpoint does not exist." } },
    { status: 404 },
  );
}
