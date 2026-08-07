import { NextResponse } from "next/server";
import { listPdfs, pdfFolder } from "@/lib/pdf-parser";

export const dynamic = "force-dynamic";

export async function GET() {
  const folder = pdfFolder();
  const pdfs = (await listPdfs(folder)).map((p) => p.split("/").pop() ?? p);
  return NextResponse.json({ folder, pdfs });
}
