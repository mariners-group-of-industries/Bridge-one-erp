import { notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";

export interface DocumentDto {
  id:           string;
  documentType: string;
  documentName: string;
  issueDate:    string | null;
  fileName:     string | null;
  createdAt:    string;
}

export interface CreateDocumentInput {
  documentType: string;
  documentName: string;
  issueDate:    string | null;
  fileName:     string | null;
}

async function assertEmployee(employeeId: string, actor: Actor) {
  const emp = await db().employee.findUnique({
    where: { id: employeeId },
    select: { id: true, office: { select: { businessUnit: { select: { companyId: true } } } } },
  });
  if (!emp) throw notFound("Employee");
  if (
    actor.companyScope !== "ALL" &&
    !actor.companyScope.includes(emp.office.businessUnit.companyId)
  ) throw notFound("Employee");
}

const toDto = (d: { id: string; documentType: string; documentName: string; issueDate: Date | null; fileName: string | null; createdAt: Date }): DocumentDto => ({
  id:           d.id,
  documentType: d.documentType,
  documentName: d.documentName,
  issueDate:    d.issueDate ? d.issueDate.toISOString().slice(0, 10) : null,
  fileName:     d.fileName,
  createdAt:    d.createdAt.toISOString(),
});

export async function listDocuments(employeeId: string, actor: Actor): Promise<DocumentDto[]> {
  await assertEmployee(employeeId, actor);
  const docs = await db().employeeDocument.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });
  return docs.map(toDto);
}

export async function createDocument(employeeId: string, actor: Actor, input: CreateDocumentInput): Promise<DocumentDto> {
  await assertEmployee(employeeId, actor);
  const doc = await db().employeeDocument.create({
    data: {
      employeeId,
      documentType: input.documentType,
      documentName: input.documentName,
      issueDate:    input.issueDate ? new Date(input.issueDate) : null,
      fileName:     input.fileName || null,
    },
  });
  return toDto(doc);
}

export async function deleteDocument(employeeId: string, docId: string, actor: Actor): Promise<void> {
  await assertEmployee(employeeId, actor);
  await db().employeeDocument.deleteMany({ where: { id: docId, employeeId } });
}
