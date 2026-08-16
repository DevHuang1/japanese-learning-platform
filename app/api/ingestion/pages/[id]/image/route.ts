import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function configuredRoots() {
  return [
    process.env.INGESTION_IMAGE_ROOT,
    path.join(process.cwd(), "storage", "ingestion"),
    path.join(process.cwd(), "tests", "fixtures"),
  ].filter((value): value is string => Boolean(value)).map((value) => path.resolve(value));
}

function safeImagePath(sourceImagePath: string) {
  const resolved = path.resolve(sourceImagePath);
  const extension = path.extname(resolved).toLowerCase();
  if (!MIME_BY_EXTENSION[extension]) return null;
  const allowed = configuredRoots().some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  return allowed ? { resolved, contentType: MIME_BY_EXTENSION[extension] } : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const page = await db.ingestionPage.findUnique({
      where: { id },
      select: { sourceImagePath: true, pageNumber: true, batch: { select: { id: true, sourceName: true } } },
    });
    if (!page?.sourceImagePath) return NextResponse.json({ error: "No source image is recorded for this page" }, { status: 404 });

    const safe = safeImagePath(page.sourceImagePath);
    if (!safe) return NextResponse.json({ error: "Source image is outside the configured ingestion image roots" }, { status: 403 });

    const image = await fs.readFile(safe.resolved);
    return new NextResponse(image, {
      headers: {
        "Content-Type": safe.contentType,
        "Content-Length": String(image.byteLength),
        "Content-Disposition": `inline; filename="page-${page.pageNumber}${path.extname(safe.resolved).toLowerCase()}"`,
        "Cache-Control": "private, max-age=60",
        "X-Ingestion-Batch": page.batch.id,
        "X-Ingestion-Source": page.batch.sourceName,
        "X-Ingestion-Page": String(page.pageNumber),
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Source image file is unavailable" }, { status: 404 });
    }
    console.error("[ingestion/pages/:id/image]", error);
    return NextResponse.json({ error: "Failed to load source image" }, { status: 500 });
  }
}
