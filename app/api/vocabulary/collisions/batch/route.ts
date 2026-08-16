import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collisionErrorResponseMessage, mergeCollision } from "@/lib/vocabulary-collisions";

export const dynamic = "force-dynamic";

const MAX_GROUPS = 100;
const MAX_ROWS = 500;

type BatchGroup = {
  targetId: string;
  sourceIds: string[];
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const groups = Array.isArray(body.groups) ? (body.groups as BatchGroup[]) : [];
    const validGroups = groups.filter(
      (group) =>
        typeof group?.targetId === "string" &&
        Array.isArray(group?.sourceIds) &&
        group.sourceIds.every((id) => typeof id === "string" && id.length > 0),
    );
    const totalRows = validGroups.reduce((total, group) => total + group.sourceIds.length + 1, 0);
    if (validGroups.length === 0 || validGroups.length > MAX_GROUPS || totalRows > MAX_ROWS) {
      return NextResponse.json(
        { error: `Provide between 1 and ${MAX_GROUPS} groups and no more than ${MAX_ROWS} total rows` },
        { status: 400 },
      );
    }

    const merged = await db.$transaction(async (tx) => {
      const results: Array<{ targetId: string; removedIds: string[] }> = [];
      for (const group of validGroups) {
        const removedIds: string[] = [];
        for (const sourceId of group.sourceIds) {
          if (sourceId === group.targetId) continue;
          const result = await mergeCollision(tx, sourceId, group.targetId);
          removedIds.push(result.removedId);
        }
        results.push({ targetId: group.targetId, removedIds });
      }
      return results;
    });

    return NextResponse.json({ groups: merged, mergedRows: merged.reduce((sum, group) => sum + group.removedIds.length, 0) });
  } catch (error) {
    const knownMessage = collisionErrorResponseMessage(error);
    if (knownMessage) {
      const status = knownMessage === "Collision row not found" ? 404 : 409;
      return NextResponse.json({ error: knownMessage, batchRolledBack: true }, { status });
    }
    console.error("[vocabulary/collisions/batch]", error);
    return NextResponse.json({ error: "Batch collision resolution failed", batchRolledBack: true }, { status: 500 });
  }
}
