import { type NextRequest } from "next/server";
import { dispatchApi } from "@/server/http/api-router";

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  request: NextRequest,
  ctx: Ctx,
) {
  const { path = [] } = await ctx.params;
  return dispatchApi(method, request, path);
}

export const GET = (request: NextRequest, ctx: Ctx) => handle("GET", request, ctx);
export const POST = (request: NextRequest, ctx: Ctx) => handle("POST", request, ctx);
export const PATCH = (request: NextRequest, ctx: Ctx) => handle("PATCH", request, ctx);
export const PUT = (request: NextRequest, ctx: Ctx) => handle("PUT", request, ctx);
export const DELETE = (request: NextRequest, ctx: Ctx) => handle("DELETE", request, ctx);
