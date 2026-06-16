import { assertInternalRequest } from "./internal-auth";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

export function createInternalPredictFetchHandler({
  internalToken
}: {
  internalToken?: string;
}) {
  return async function handleInternalPredictRequest(request: Request): Promise<Response> {
    try {
      assertInternalRequest(request, internalToken);
      if (request.method === "OPTIONS") {
        return emptyResponse(204);
      }

      return errorResponse(501, "NOT_IMPLEMENTED", "Internal Predict API endpoints are not implemented yet");
    } catch (error) {
      return internalErrorToResponse(error);
    }
  };
}

function internalErrorToResponse(error: unknown): Response {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
  }

  if (error instanceof Error && error.message === "INTERNAL_API_DISABLED") {
    return errorResponse(503, "INTERNAL_API_DISABLED", "Internal API is disabled");
  }

  return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({
    error: {
      code,
      message
    }
  }, status);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCors({
      "content-type": "application/json"
    })
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: withCors()
  });
}

function withCors(headers: HeadersInit = {}): Headers {
  return new Headers({
    ...corsHeaders,
    ...headers
  });
}
