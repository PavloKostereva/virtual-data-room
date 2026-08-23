

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(description, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  \u001b[32m✓\u001b[0m ${description}`);
  } else {
    failed += 1;
    console.log(`  \u001b[31m✗\u001b[0m ${description}${extra ? ` — ${extra}` : ""}`);
  }
}

function section(title) {
  console.log(`\n\u001b[1m${title}\u001b[0m`);
}

class Client {
  constructor(name) {
    this.name = name;
    this.cookie = "";
  }

  async request(path, { method = "GET", body, headers = {}, raw = false } = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: raw ? "manual" : "follow",
    });

    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length > 0) {
      this.cookie = setCookie.map((entry) => entry.split(";")[0]).join("; ");
    }

    if (raw) return response;

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, data };
  }
}

function makePdf(label) {
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R>>endobj
4 0 obj<</Length ${label.length + 40}>>stream
BT /F1 12 Tf 20 50 Td (${label}) Tj ET
endstream endobj
trailer<</Root 1 0 R>>
%%EOF`;
  return Buffer.from(content, "utf8");
}

async function uploadFile(client, folderId, fileName, conflictStrategy = "fail") {
  const bytes = makePdf(fileName);

  const ticketResponse = await client.request("/api/files/upload-ticket", {
    method: "POST",
    body: { folderId, fileName, mimeType: "application/pdf", size: bytes.byteLength },
  });
  if (ticketResponse.status !== 200) return ticketResponse;

  const { ticket } = ticketResponse.data;
  const putResponse = await fetch(
    ticket.url.startsWith("http") ? ticket.url : `${BASE_URL}${ticket.url}`,
    { method: "PUT", headers: ticket.headers, body: bytes },
  );
  if (!putResponse.ok) {
    return { status: putResponse.status, data: { error: { message: "storage PUT failed" } } };
  }

  return client.request("/api/files", {
    method: "POST",
    body: {
      folderId,
      fileName,
      mimeType: "application/pdf",
      storageKey: ticket.storageKey,
      conflictStrategy,
    },
  });
}

async function main() {
  const stamp = Date.now();
  const owner = new Client("owner");
  const invitee = new Client("invitee");
  const anonymous = new Client("anonymous");

  const ownerEmail = `owner-${stamp}@example.com`;
  const inviteeEmail = `invitee-${stamp}@example.com`;

  section("Authentication");
  const registered = await owner.request("/api/auth/register", {
    method: "POST",
    body: { name: "Ada Owner", email: ownerEmail, password: "correct-horse-battery" },
  });
  check("owner can register", registered.status === 200, JSON.stringify(registered.data));

  const weak = await new Client("weak").request("/api/auth/register", {
    method: "POST",
    body: { name: "Weak", email: `weak-${stamp}@example.com`, password: "short" },
  });
  check("short passwords are rejected", weak.status === 400);

  const duplicate = await new Client("dup").request("/api/auth/register", {
    method: "POST",
    body: { name: "Dup", email: ownerEmail, password: "correct-horse-battery" },
  });
  check("duplicate email is rejected", duplicate.status === 409);

  const signedIn = await owner.request("/api/auth/login", {
    method: "POST",
    body: { email: ownerEmail, password: "correct-horse-battery" },
  });
  check("owner can sign in", signedIn.status === 200, JSON.stringify(signedIn.data));

  const me = await owner.request("/api/auth/me");
  check("session cookie identifies the owner", me.data?.user?.email === ownerEmail);

  const anonMe = await anonymous.request("/api/auth/me");
  check("anonymous visitor has no session", anonMe.data?.user === null);

  section("Password reset");
  const resetter = new Client("resetter");
  const resetEmail = `reset-${stamp}@example.com`;
  const resetRegistered = await resetter.request("/api/auth/register", {
    method: "POST",
    body: { name: "Riley Reset", email: resetEmail, password: "old-password-1" },
  });
  check("reset user can register", resetRegistered.status === 200, JSON.stringify(resetRegistered.data));

  const unknownReset = await anonymous.request("/api/auth/forgot-password", {
    method: "POST",
    body: { email: `missing-${stamp}@example.com` },
  });
  check("unknown emails still get a generic success", unknownReset.status === 200);
  check("unknown emails do not receive a code", unknownReset.data?.code == null);

  const demoReset = await anonymous.request("/api/auth/forgot-password", {
    method: "POST",
    body: { email: "demo@vault.app" },
  });
  check("demo accounts cannot be reset", demoReset.status === 400);

  const forgot = await anonymous.request("/api/auth/forgot-password", {
    method: "POST",
    body: { email: resetEmail },
  });
  check(
    "forgot password issues a demo code",
    forgot.status === 200 && typeof forgot.data?.code === "string",
    JSON.stringify(forgot.data),
  );

  const badCode = await anonymous.request("/api/auth/reset-password", {
    method: "POST",
    body: { email: resetEmail, code: "000000", password: "new-password-1" },
  });
  check("wrong reset codes are rejected", badCode.status === 400);

  const resetOk = await anonymous.request("/api/auth/reset-password", {
    method: "POST",
    body: { email: resetEmail, code: forgot.data.code, password: "new-password-1" },
  });
  check("password can be reset with the code", resetOk.status === 200, JSON.stringify(resetOk.data));

  const oldLogin = await new Client("old").request("/api/auth/login", {
    method: "POST",
    body: { email: resetEmail, password: "old-password-1" },
  });
  check("old password no longer works", oldLogin.status === 401);

  const newLogin = await resetter.request("/api/auth/login", {
    method: "POST",
    body: { email: resetEmail, password: "new-password-1" },
  });
  check("new password signs in", newLogin.status === 200);

  const change = await resetter.request("/api/auth/change-password", {
    method: "POST",
    body: { currentPassword: "new-password-1", newPassword: "newer-password-1" },
  });
  check("signed-in user can change password", change.status === 200, JSON.stringify(change.data));

  const afterChange = await new Client("after").request("/api/auth/login", {
    method: "POST",
    body: { email: resetEmail, password: "newer-password-1" },
  });
  check("changed password signs in", afterChange.status === 200);

  const unauthChange = await anonymous.request("/api/auth/change-password", {
    method: "POST",
    body: { currentPassword: "x", newPassword: "abcdefgh" },
  });
  check("change password requires a session", unauthChange.status === 401);

  section("Data rooms and folders");
  const roomResponse = await owner.request("/api/data-rooms", {
    method: "POST",
    body: { name: `Project Atlas ${stamp}`, description: "Smoke test" },
  });
  const room = roomResponse.data?.dataRoom;
  check("data room is created with a root folder", Boolean(room?.rootFolderId));

  const unauthorised = await anonymous.request("/api/data-rooms");
  check("listing data rooms requires a session", unauthorised.status === 401);

  const legal = (
    await owner.request("/api/folders", {
      method: "POST",
      body: { parentId: room.rootFolderId, name: "Legal" },
    })
  ).data?.folder;
  check("folder is created", legal?.name === "Legal");

  const ndas = (
    await owner.request("/api/folders", {
      method: "POST",
      body: { parentId: legal.id, name: "NDAs" },
    })
  ).data?.folder;
  check("folders nest", ndas?.parentId === legal.id);

  const duplicateFolder = await owner.request("/api/folders", {
    method: "POST",
    body: { parentId: room.rootFolderId, name: "Legal" },
  });
  check("duplicate sibling folder name is rejected", duplicateFolder.status === 409);

  const badName = await owner.request("/api/folders", {
    method: "POST",
    body: { parentId: room.rootFolderId, name: "in/valid" },
  });
  check("illegal characters are rejected", badName.status === 400);

  const view = await owner.request(`/api/folders/${ndas.id}`);
  check(
    "breadcrumbs walk the full path",
    view.data?.breadcrumbs?.length === 3 && view.data.breadcrumbs[2].name === "NDAs",
    JSON.stringify(view.data?.breadcrumbs),
  );

  section("Uploads, conflicts and versioning");
  const firstUpload = await uploadFile(owner, ndas.id, "mutual-nda.pdf");
  check("file uploads through the signed URL", firstUpload.data?.file?.name === "mutual-nda.pdf");
  check("first upload is version 1", firstUpload.data?.file?.versionCount === 1);

  const conflicting = await uploadFile(owner, ndas.id, "mutual-nda.pdf");
  check("same-name upload reports a conflict", conflicting.status === 409);
  check(
    "conflict response suggests a free name",
    conflicting.data?.error?.details?.suggestedName === "mutual-nda (1).pdf",
    JSON.stringify(conflicting.data?.error?.details),
  );

  const versioned = await uploadFile(owner, ndas.id, "mutual-nda.pdf", "version");
  check("resolving as a version bumps versionCount", versioned.data?.file?.versionCount === 2);
  check("versioning keeps one file", versioned.data?.resolution === "versioned");

  const renamed = await uploadFile(owner, ndas.id, "mutual-nda.pdf", "rename");
  check(
    "resolving as a copy de-duplicates the name",
    renamed.data?.file?.name === "mutual-nda (1).pdf",
    renamed.data?.file?.name,
  );

  const oversize = await owner.request("/api/files/upload-ticket", {
    method: "POST",
    body: {
      folderId: ndas.id,
      fileName: "huge.pdf",
      mimeType: "application/pdf",
      size: 999_999_999,
    },
  });
  check("oversized uploads are refused up front", oversize.status === 413);

  const badType = await owner.request("/api/files/upload-ticket", {
    method: "POST",
    body: { folderId: ndas.id, fileName: "run.exe", mimeType: "application/x-msdownload", size: 10 },
  });
  check("unsupported file types are refused", badType.status === 415);

  const fileId = versioned.data.file.id;
  const detail = await owner.request(`/api/files/${fileId}`);
  check("version history is returned", detail.data?.file?.versions?.length === 2);

  const content = await owner.request(`/api/files/${fileId}/content`, { raw: true });
  check(
    "content route redirects to storage",
    content.status === 302 && Boolean(content.headers.get("location")),
    `status ${content.status}`,
  );

  section("Listing, search and moving");
  const children = await owner.request(`/api/folders/${ndas.id}/children?limit=50`);
  check("folder lists its files", children.data?.items?.length === 2);

  const paged = await owner.request(`/api/folders/${ndas.id}/children?limit=1`);
  check("listing paginates with a cursor", Boolean(paged.data?.nextCursor));
  const nextPage = await owner.request(
    `/api/folders/${ndas.id}/children?limit=1&cursor=${encodeURIComponent(paged.data.nextCursor)}`,
  );
  check(
    "cursor returns the next item, not a repeat",
    nextPage.data?.items?.[0]?.id !== paged.data.items[0].id,
  );

  const search = await owner.request(`/api/folders/${room.rootFolderId}/search?q=mutual`);
  check("search finds files anywhere in the subtree", search.data?.results?.length === 2);
  check(
    "search results carry their location",
    search.data?.results?.[0]?.location?.join("/") === "All files/Legal/NDAs",
    JSON.stringify(search.data?.results?.[0]?.location),
  );

  const moved = await owner.request(`/api/files/${fileId}`, {
    method: "PATCH",
    body: { folderId: legal.id },
  });
  check("file moves to another folder", moved.data?.file?.folderId === legal.id);

  const renamedFile = await owner.request(`/api/files/${fileId}`, {
    method: "PATCH",
    body: { name: "signed-nda.pdf" },
  });
  check("file is renamed", renamedFile.data?.file?.name === "signed-nda.pdf");

  const stats = await owner.request(`/api/folders/${legal.id}/stats`);
  check(
    "subtree stats count nested content",
    stats.data?.fileCount === 2 && stats.data?.folderCount === 1,
    JSON.stringify(stats.data),
  );

  const cycle = await owner.request(`/api/folders/${legal.id}`, {
    method: "PATCH",
    body: { parentId: ndas.id },
  });
  check("a folder cannot be moved inside itself", cycle.status === 400);

  section("Public link sharing");
  const link = await owner.request("/api/shares", {
    method: "POST",
    body: { subjectType: "FOLDER", subjectId: ndas.id, mode: "PUBLIC_LINK" },
  });
  const token = link.data?.share?.url?.split("/share/")[1];
  check("public link is created", Boolean(token));

  const anonView = await anonymous.request(`/api/folders/${ndas.id}`, {
    headers: { "x-share-token": token },
  });
  check("anonymous visitor can read the shared folder", anonView.status === 200);
  check("shared view is read-only", anonView.data?.access?.canWrite === false);
  check(
    "breadcrumbs are clipped to the shared folder",
    anonView.data?.breadcrumbs?.length === 1,
    JSON.stringify(anonView.data?.breadcrumbs),
  );

  const anonEscape = await anonymous.request(`/api/folders/${room.rootFolderId}`, {
    headers: { "x-share-token": token },
  });
  check("the link does not grant access to ancestors", anonEscape.status === 404);

  const anonWrite = await anonymous.request("/api/folders", {
    method: "POST",
    headers: { "x-share-token": token },
    body: { parentId: ndas.id, name: "Injected" },
  });
  check("anonymous visitor cannot write", anonWrite.status === 401 || anonWrite.status === 403);

  const noToken = await anonymous.request(`/api/folders/${ndas.id}`);
  check("without the token the folder is invisible", noToken.status === 404);

  await owner.request(`/api/shares/${link.data.share.id}`, { method: "DELETE" });
  const afterRevoke = await anonymous.request(`/api/folders/${ndas.id}`, {
    headers: { "x-share-token": token },
  });
  check("revoking the link cuts access immediately", afterRevoke.status === 404);

  section("Permissioned sharing");
  await invitee.request("/api/auth/register", {
    method: "POST",
    body: { name: "Bob Invitee", email: inviteeEmail, password: "correct-horse-battery" },
  });
  await invitee.request("/api/auth/login", {
    method: "POST",
    body: { email: inviteeEmail, password: "correct-horse-battery" },
  });

  const beforeInvite = await invitee.request(`/api/folders/${legal.id}`);
  check("a stranger cannot see the folder", beforeInvite.status === 404);

  const invited = await owner.request("/api/shares", {
    method: "POST",
    body: {
      subjectType: "FOLDER",
      subjectId: legal.id,
      mode: "RESTRICTED",
      emails: [inviteeEmail],
    },
  });
  check("recipient is granted access", invited.data?.share?.grants?.length === 1);

  const inviteeView = await invitee.request(`/api/folders/${legal.id}`);
  check("invited user can read the folder", inviteeView.status === 200);
  check("invited user is read-only", inviteeView.data?.access?.canWrite === false);

  const inviteeNested = await invitee.request(`/api/folders/${ndas.id}`);
  check("access cascades to nested folders", inviteeNested.status === 200);

  const inviteeWrite = await invitee.request(`/api/folders/${ndas.id}`, {
    method: "PATCH",
    body: { name: "Hijacked" },
  });
  check("invited user cannot rename", inviteeWrite.status === 403);

  const inviteeShare = await invitee.request("/api/shares", {
    method: "POST",
    body: { subjectType: "FOLDER", subjectId: legal.id, mode: "PUBLIC_LINK" },
  });
  check("invited user cannot re-share", inviteeShare.status === 403);

  const inbox = await invitee.request("/api/shared-with-me");
  check("shared item appears in the recipient's inbox", inbox.data?.items?.length === 1);

  const grantId = invited.data.share.grants[0].id;
  await owner.request(`/api/shares/${invited.data.share.id}/grants/${grantId}`, {
    method: "DELETE",
  });
  const afterGrantRevoke = await invitee.request(`/api/folders/${legal.id}`);
  check("revoking a recipient cuts access immediately", afterGrantRevoke.status === 404);

  section("Deletion");
  const deleteFolder = await owner.request(`/api/folders/${legal.id}`, { method: "DELETE" });
  check("folder moves to trash", deleteFolder.status === 204);

  const deletedChild = await owner.request(`/api/folders/${ndas.id}`);
  check("nested folders disappear from the live tree", deletedChild.status === 404);

  const deletedFile = await owner.request(`/api/files/${fileId}`);
  check("nested files disappear from the live tree", deletedFile.status === 404);

  const rootAfter = await owner.request(`/api/folders/${room.rootFolderId}/children`);
  check("root folder looks empty", rootAfter.data?.items?.length === 0);

  const trashList = await owner.request("/api/trash");
  const trashedLegal = trashList.data?.items?.find(
    (entry) => entry.item?.kind === "folder" && entry.item?.id === legal.id,
  );
  check("trashed folder appears in trash", Boolean(trashedLegal));

  const restoreFolder = await owner.request("/api/trash/restore", {
    method: "POST",
    body: { kind: "folder", id: legal.id },
  });
  check("folder restores from trash", restoreFolder.status === 200);

  const restoredChild = await owner.request(`/api/folders/${ndas.id}`);
  check("nested folders come back after restore", restoredChild.status === 200);

  const restoredFile = await owner.request(`/api/files/${fileId}`);
  check("nested files come back after restore", restoredFile.status === 200);

  await owner.request(`/api/folders/${legal.id}`, { method: "DELETE" });
  const permanentDelete = await owner.request(`/api/trash/folder/${legal.id}`, {
    method: "DELETE",
  });
  check("folder can be permanently deleted from trash", permanentDelete.status === 204);

  const goneChild = await owner.request(`/api/folders/${ndas.id}`);
  check("permanently deleted nested folders stay gone", goneChild.status === 404);

  const trashAfter = await owner.request("/api/trash");
  check(
    "permanently deleted folder leaves trash",
    !trashAfter.data?.items?.some((entry) => entry.item?.id === legal.id),
  );

  const deleteRoot = await owner.request(`/api/folders/${room.rootFolderId}`, {
    method: "DELETE",
  });
  check("the root folder cannot be deleted", deleteRoot.status === 400);

  const deleteRoom = await owner.request(`/api/data-rooms/${room.id}`, { method: "DELETE" });
  check("data room moves to trash", deleteRoom.status === 204);

  const roomAfterDelete = await owner.request(`/api/data-rooms/${room.id}`);
  check("trashed data room is hidden from live listing", roomAfterDelete.status === 404);

  const trashWithRoom = await owner.request("/api/trash");
  check(
    "trashed data room appears in trash",
    Boolean(
      trashWithRoom.data?.items?.some(
        (entry) => entry.item?.kind === "dataRoom" && entry.item?.id === room.id,
      ),
    ),
  );

  const restoreRoom = await owner.request("/api/trash/restore", {
    method: "POST",
    body: { kind: "dataRoom", id: room.id },
  });
  check("data room restores from trash", restoreRoom.status === 200);

  const roomAfterRestore = await owner.request(`/api/data-rooms/${room.id}`);
  check("restored data room is reachable again", roomAfterRestore.status === 200);

  await owner.request(`/api/data-rooms/${room.id}`, { method: "DELETE" });
  const permanentRoom = await owner.request(`/api/trash/dataRoom/${room.id}`, {
    method: "DELETE",
  });
  check("data room can be permanently deleted from trash", permanentRoom.status === 204);

  const roomGone = await owner.request(`/api/data-rooms/${room.id}`);
  check("permanently deleted data room stays gone", roomGone.status === 404);

  console.log(
    `\n\u001b[1m${passed} passed, ${failed} failed\u001b[0m (${passed + failed} checks)\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nSmoke test crashed:", error);
  process.exit(1);
});
