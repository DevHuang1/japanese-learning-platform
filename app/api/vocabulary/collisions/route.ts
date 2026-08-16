import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  collisionErrorResponseMessage,
  collisionSelect,
  groupCollisionRows,
  mergeCollision,
} from "@/lib/vocabulary-collisions";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.vocabulary.findMany({ select: collisionSelect });
  return NextResponse.json({ collisions: groupCollisionRows(rows) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await db.$transaction((tx) =>
      mergeCollision(tx, String(body.sourceId ?? ""), String(body.targetId ?? "")),
    );
    return NextResponse.json(result);
  } catch (error) {
    const knownMessage = collisionErrorResponseMessage(error);
    if (knownMessage) {
      const status = knownMessage === "Collision row not found" ? 404 : 409;
      return NextResponse.json({ error: knownMessage }, { status });
    }
    console.error("[vocabulary/collisions]", error);
    return NextResponse.json({ error: "Failed to resolve vocabulary collision" }, { status: 500 });
  }
}
