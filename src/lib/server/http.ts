export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function jsonError(message: string, status = 500, details?: unknown): Response {
  return Response.json(
    {
      ok: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export function createTextStreamResponse(stream: AsyncIterable<string>): Response {
  const encoder = new TextEncoder();
  const iterator = stream[Symbol.asyncIterator]();

  const readable = new ReadableStream<Uint8Array>({
    async pull(controller) {
      let next: IteratorResult<string>;

      try {
        next = await iterator.next();
      } catch (error) {
        controller.error(error);
        return;
      }

      if (next.done) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(next.value));
    },
    async cancel() {
      if (iterator.return) {
        await iterator.return();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
