import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import {
  pipelineInputSchema,
  pipelineListQuerySchema,
  type ApprovalFormOptions,
  type PipelineData,
  type PipelineDto,
  type PipelineInput,
  type PipelineList,
  type PipelineListQuery,
  type UserType,
} from "../schemas/approval.schema";

type Tx = Prisma.TransactionClient;

// ─── Scoping & helpers ────────────────────────────────────────────────────────

function unitScope(actor: Actor): Prisma.BusinessUnitWhereInput {
  return actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
}

/** Users the actor may pick: active, and (when scoped) with access to one of the actor's units. */
function userScope(actor: Actor): Prisma.UserWhereInput {
  return actor.companyScope === "ALL" ? { isActive: true } : { isActive: true, businessUnitAccess: { some: { businessUnit: unitScope(actor) } } };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
const orNull = (value: string) => (value === "" ? null : value);
const asUserType = (value: string): UserType => (value === "EMPLOYEE" ? "EMPLOYEE" : "USER");

const pipelineInclude = {
  superApproverUser: { select: { name: true } },
  superApproverEmployee: { select: { name: true } },
  stages: {
    orderBy: { stageNo: "asc" },
    include: {
      approvers: {
        orderBy: { sortOrder: "asc" },
        include: { businessUnit: { select: { name: true } }, user: { select: { name: true } }, employee: { select: { name: true } } },
      },
    },
  },
} satisfies Prisma.ApprovalPipelineInclude;

type PipelineRecord = Prisma.ApprovalPipelineGetPayload<{ include: typeof pipelineInclude }>;

function toDto(record: PipelineRecord): PipelineDto {
  const userType = asUserType(record.userType);
  return {
    id: record.id,
    name: record.name,
    feature: record.feature,
    userType,
    superApproverId: (userType === "USER" ? record.superApproverUserId : record.superApproverEmployeeId) ?? "",
    superApproverName: (userType === "USER" ? record.superApproverUser?.name : record.superApproverEmployee?.name) ?? null,
    remarks: record.remarks ?? "",
    stages: record.stages.map((stage) => ({
      id: stage.id,
      stageNo: stage.stageNo,
      name: stage.name,
      approvalOrder: stage.approvalOrder,
      requiredCount: stage.requiredCount,
      approvers: stage.approvers.map((a) => {
        const type = asUserType(a.userType);
        return {
          id: a.id,
          userType: type,
          businessUnitId: a.businessUnitId ?? "",
          businessUnitName: a.businessUnit?.name ?? null,
          approverId: (type === "USER" ? a.userId : a.employeeId) ?? "",
          approverName: (type === "USER" ? a.user?.name : a.employee?.name) ?? "(removed)",
          authorizationType: a.authorizationType,
        };
      }),
    })),
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listPipelines(_actor: Actor, input: PipelineListQuery): Promise<PipelineList> {
  const query = pipelineListQuerySchema.parse(input);
  const search = query.search ? { contains: escapeLike(query.search), mode: "insensitive" as const } : undefined;
  const where: Prisma.ApprovalPipelineWhereInput = search ? { OR: [{ name: search }, { feature: search }, { superApproverUser: { name: search } }, { superApproverEmployee: { name: search } }] } : {};
  const [total, records] = await Promise.all([
    db().approvalPipeline.count({ where }),
    db().approvalPipeline.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { superApproverUser: { select: { name: true } }, superApproverEmployee: { select: { name: true } }, _count: { select: { stages: true } } },
    }),
  ]);
  return {
    rows: records.map((r) => ({
      id: r.id,
      name: r.name,
      feature: r.feature,
      superApproverName: (r.userType === "EMPLOYEE" ? r.superApproverEmployee?.name : r.superApproverUser?.name) ?? null,
      stageCount: r._count.stages,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getPipeline(_actor: Actor, id: string): Promise<PipelineDto> {
  const record = await db().approvalPipeline.findUnique({ where: { id }, include: pipelineInclude });
  if (!record) throw notFound("Approval pipeline");
  return toDto(record);
}

export async function getApprovalFormOptions(actor: Actor): Promise<ApprovalFormOptions> {
  const [businessUnits, users, employees] = await Promise.all([
    db().businessUnit.findMany({ where: unitScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db().user.findMany({ where: userScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true, businessUnitAccess: { select: { businessUnitId: true } } } }),
    // Only what the picker needs: no contact or personal details.
    db().employee.findMany({
      where: { isActive: true, office: { businessUnit: unitScope(actor) } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true, designation: true, office: { select: { businessUnitId: true } } },
    }),
  ]);
  return {
    businessUnits,
    users: users.map((u) => ({ id: u.id, name: u.name, businessUnitIds: u.businessUnitAccess.map((a) => a.businessUnitId) })),
    employees: employees.map((e) => ({ id: e.id, name: e.name, code: e.employeeCode, designation: e.designation, businessUnitId: e.office.businessUnitId })),
  };
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/** Every person and business unit referenced must exist and be within the actor's scope. */
async function checkPeople(actor: Actor, data: PipelineData) {
  const userIds = new Set<string>();
  const employeeIds = new Set<string>();
  const unitIds = new Set<string>();
  (data.userType === "USER" ? userIds : employeeIds).add(data.superApproverId);
  for (const stage of data.stages) {
    for (const approver of stage.approvers) {
      (approver.userType === "USER" ? userIds : employeeIds).add(approver.approverId);
      if (approver.businessUnitId) unitIds.add(approver.businessUnitId);
    }
  }
  const [users, employees, units] = await Promise.all([
    db().user.findMany({ where: { id: { in: [...userIds] }, ...userScope(actor) }, select: { id: true } }),
    db().employee.findMany({ where: { id: { in: [...employeeIds] }, isActive: true, office: { businessUnit: unitScope(actor) } }, select: { id: true, office: { select: { businessUnitId: true } } } }),
    db().businessUnit.findMany({ where: { id: { in: [...unitIds] }, ...unitScope(actor) }, select: { id: true } }),
  ]);
  if (users.length !== userIds.size) throw badRequest("Select active users you can access.");
  if (employees.length !== employeeIds.size) throw badRequest("Select active employees you can access.");
  if (units.length !== unitIds.size) throw badRequest("Select business units you can access.");
  const employeeUnit = new Map(employees.map((e) => [e.id, e.office.businessUnitId]));
  for (const stage of data.stages) {
    for (const approver of stage.approvers) {
      if (approver.userType === "EMPLOYEE" && approver.businessUnitId && employeeUnit.get(approver.approverId) !== approver.businessUnitId) {
        throw badRequest(`Stage "${stage.name}": an approver does not belong to the selected business unit.`);
      }
    }
  }
}

const headerData = (data: PipelineData) => ({
  name: data.name,
  feature: data.feature,
  userType: data.userType,
  superApproverUserId: data.userType === "USER" ? data.superApproverId : null,
  superApproverEmployeeId: data.userType === "EMPLOYEE" ? data.superApproverId : null,
  remarks: orNull(data.remarks),
});

/** Keeps saved stages (matched by id), removes the rest, numbers them 1…n in order. */
async function writeStages(tx: Tx, pipelineId: string, stages: PipelineData["stages"]) {
  const existing = await tx.approvalStage.findMany({ where: { pipelineId }, select: { id: true } });
  const known = new Set(existing.map((s) => s.id));
  for (const stage of stages) if (stage.id && !known.has(stage.id)) throw badRequest("A stage no longer exists. Reload the page.");
  const keep = new Set(stages.map((s) => s.id).filter(Boolean));
  await tx.approvalStage.deleteMany({ where: { pipelineId, id: { notIn: [...keep] } } });
  // Park the kept stages on negative numbers so renumbering never collides.
  await tx.approvalStage.updateMany({ where: { pipelineId }, data: { stageNo: { multiply: -1 } } });

  for (const [index, stage] of stages.entries()) {
    const values = { stageNo: index + 1, name: stage.name, approvalOrder: stage.approvalOrder, requiredCount: stage.requiredCount };
    const stageId = stage.id ? (await tx.approvalStage.update({ where: { id: stage.id }, data: values })).id : (await tx.approvalStage.create({ data: { pipelineId, ...values } })).id;
    await tx.approvalStageApprover.deleteMany({ where: { stageId } });
    await tx.approvalStageApprover.createMany({
      data: stage.approvers.map((a, sortOrder) => ({
        stageId,
        sortOrder,
        userType: a.userType,
        businessUnitId: orNull(a.businessUnitId),
        userId: a.userType === "USER" ? a.approverId : null,
        employeeId: a.userType === "EMPLOYEE" ? a.approverId : null,
        authorizationType: a.authorizationType,
      })),
    });
  }
}

const duplicateName = (error: unknown, name: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? conflict(`A pipeline named "${name}" already exists.`) : error;

export async function createPipeline(actor: Actor, input: PipelineInput): Promise<PipelineDto> {
  const data = pipelineInputSchema.parse(input);
  if (data.stages.some((s) => s.id)) throw badRequest("New pipelines cannot reuse saved stages.");
  await checkPeople(actor, data);
  try {
    const id = await db().$transaction(
      async (tx) => {
        const created = await tx.approvalPipeline.create({ data: headerData(data) });
        await writeStages(tx, created.id, data.stages);
        return created.id;
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
    return getPipeline(actor, id);
  } catch (error) {
    throw duplicateName(error, data.name);
  }
}

export async function updatePipeline(actor: Actor, id: string, input: PipelineInput): Promise<PipelineDto> {
  const data = pipelineInputSchema.parse(input);
  if (!(await db().approvalPipeline.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Approval pipeline");
  await checkPeople(actor, data);
  try {
    await db().$transaction(
      async (tx) => {
        await tx.approvalPipeline.update({ where: { id }, data: headerData(data) });
        await writeStages(tx, id, data.stages);
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  } catch (error) {
    throw duplicateName(error, data.name);
  }
  return getPipeline(actor, id);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deletePipeline(_actor: Actor, id: string): Promise<void> {
  const { count } = await db().approvalPipeline.deleteMany({ where: { id } });
  if (count === 0) throw notFound("Approval pipeline");
}

/** Deletes one stage and renumbers the rest. The last stage cannot be deleted. */
export async function deleteStage(actor: Actor, pipelineId: string, stageId: string): Promise<PipelineDto> {
  await db().$transaction(async (tx) => {
    const stages = await tx.approvalStage.findMany({ where: { pipelineId }, orderBy: { stageNo: "asc" }, select: { id: true } });
    if (!stages.some((s) => s.id === stageId)) throw notFound("Stage");
    if (stages.length === 1) throw badRequest("A pipeline needs at least one stage. Delete the pipeline instead.");
    await tx.approvalStage.delete({ where: { id: stageId } });
    const rest = stages.filter((s) => s.id !== stageId);
    await tx.approvalStage.updateMany({ where: { pipelineId }, data: { stageNo: { multiply: -1 } } });
    for (const [index, stage] of rest.entries()) await tx.approvalStage.update({ where: { id: stage.id }, data: { stageNo: index + 1 } });
  });
  return getPipeline(actor, pipelineId);
}
