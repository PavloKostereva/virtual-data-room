import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type output, type ZodTypeAny } from "zod";
import { AppError, badRequest } from "@/server/errors";
import { createRequestContext, type RequestContext } from "@/server/http/context";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface RouteArgs<TParams> {
  request: NextRequest;
  context: RequestContext;
  params: TParams;
}

type RouteHandler<TParams> = (args: RouteArgs<TParams>) => Promise<unknown>;

export function defineRoute<TParams = Record<string, never>>(handler: RouteHandler<TParams>) {
  return async (
    request: NextRequest,
    segment: { params: Promise<TParams> },
  ): Promise<Response> => {
    try {
      const context = await createRequestContext(request);

      const params = ((await segment?.params) ?? {}) as TParams;
      const result = await handler({ request, context, params });

      if (result instanceof Response) return result;
      if (result === undefined || result === null) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json(result);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(
  request: NextRequest,
  schema: S,
): Promise<output<S>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(payload) as output<S>;
}

export function parseQuery<S extends ZodTypeAny>(request: NextRequest, schema: S): output<S> {
  return schema.parse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  ) as output<S>;
}

function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1000", "P1001", "P1008", "P1017"].includes(error.code)
  ) {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("can't reach database") ||
      message.includes("connection") ||
      message.includes("connect econnrefused") ||
      message.includes("database server")
    );
  }
  return false;
}

export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: error.issues[0]?.message ?? "The request was not valid.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "An item with that name already exists here.",
        },
      },
      { status: 409 },
    );
  }

  if (isDatabaseConnectionError(error)) {
    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message:
            "The app cannot connect to the database right now. If this keeps happening, the server configuration may need to be checked.",
        },
      },
      { status: 503 },
    );
  }

  console.error("[api] unhandled error", error);

  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}
