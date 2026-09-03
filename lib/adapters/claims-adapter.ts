import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import { pool } from "@/lib/db/client";
import { canonicalJson, inputHash } from "@/lib/domain/canonical-json";
import {
  EnterpriseVersionConflictError,
  EnterpriseError
} from "@/lib/domain/errors";
import type { AdapterMutationResult, ClaimAggregate } from "@/lib/domain/types";

import type {
  AddClaimNoteInput,
  EnterpriseAdapter,
  IssueSettlementInput,
  MutationContext,
  ScheduleInspectionInput,
  SetReserveInput
} from "./enterprise-adapter";
import { resultFromLedger } from "./enterprise-adapter";

type LedgerRow = {
  key: string;
  normalized_input_hash: string;
  result_json: Record<string, unknown>;
  claim_version_after: number;
};

export class ClaimsEnterpriseAdapter implements EnterpriseAdapter {
  async getClaim(claimId: string): Promise<ClaimAggregate> {
    const claimResult = await pool.query<{
      id: string;
      status: ClaimAggregate["status"];
      claimant_name: string;
      loss_type: string;
      reserve_amount_cents: string;
      estimated_loss_cents: string | null;
      version: number;
    }>(
      `
        SELECT id, status, claimant_name, loss_type, reserve_amount_cents, estimated_loss_cents, version
        FROM claims
        WHERE id = $1
      `,
      [claimId]
    );
    const claim = claimResult.rows[0];
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const [inspections, settlements, notes] = await Promise.all([
      pool.query<{
        id: string;
        network: string;
        status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
        scheduled_for: Date | null;
        idempotency_key: string;
        created_at: Date;
      }>(
        `
          SELECT id, network, status, scheduled_for, idempotency_key, created_at
          FROM claim_inspections
          WHERE claim_id = $1
          ORDER BY created_at, id
        `,
        [claimId]
      ),
      pool.query<{
        id: string;
        amount_cents: string;
        status: "ISSUED" | "VOIDED";
        idempotency_key: string;
        created_at: Date;
      }>(
        `
          SELECT id, amount_cents, status, idempotency_key, created_at
          FROM claim_settlements
          WHERE claim_id = $1
          ORDER BY created_at, id
        `,
        [claimId]
      ),
      pool.query<{
        id: string;
        body: string;
        idempotency_key: string;
        created_at: Date;
      }>(
        `
          SELECT id, body, idempotency_key, created_at
          FROM claim_notes
          WHERE claim_id = $1
          ORDER BY created_at, id
        `,
        [claimId]
      )
    ]);

    return {
      id: claim.id,
      status: claim.status,
      claimantName: claim.claimant_name,
      lossType: claim.loss_type,
      reserveAmountCents: Number(claim.reserve_amount_cents),
      estimatedLossCents:
        claim.estimated_loss_cents === null ? null : Number(claim.estimated_loss_cents),
      version: claim.version,
      inspections: inspections.rows.map((row) => ({
        id: row.id,
        network: row.network,
        status: row.status,
        scheduledFor: row.scheduled_for?.toISOString() ?? null,
        idempotencyKey: row.idempotency_key,
        createdAt: row.created_at.toISOString()
      })),
      settlements: settlements.rows.map((row) => ({
        id: row.id,
        amountCents: Number(row.amount_cents),
        status: row.status,
        idempotencyKey: row.idempotency_key,
        createdAt: row.created_at.toISOString()
      })),
      notes: notes.rows.map((row) => ({
        id: row.id,
        body: row.body,
        idempotencyKey: row.idempotency_key,
        createdAt: row.created_at.toISOString()
      }))
    };
  }

  async setReserve(input: SetReserveInput, ctx: MutationContext): Promise<AdapterMutationResult> {
    return this.mutate("SET_RESERVE", input.claimId, input, ctx, async (client) => {
      const operationId = randomUUID();
      const version = await this.bumpExpectedVersion(client, input.claimId, ctx.expectedVersion, {
        reserve_amount_cents: input.reserveAmountCents
      });
      return {
        operationId,
        returnedVersion: version,
        responseJson: {
          operationId,
          claimId: input.claimId,
          reserveAmountCents: input.reserveAmountCents,
          version
        }
      };
    });
  }

  async scheduleInspection(
    input: ScheduleInspectionInput,
    ctx: MutationContext
  ): Promise<AdapterMutationResult> {
    return this.mutate("SCHEDULE_INSPECTION", input.claimId, input, ctx, async (client) => {
      const operationId = randomUUID();
      await client.query(
        `
          INSERT INTO claim_inspections (claim_id, network, status, idempotency_key)
          VALUES ($1, $2, 'SCHEDULED', $3)
        `,
        [input.claimId, input.network, ctx.idempotencyKey]
      );
      const version = await this.bumpExpectedVersion(client, input.claimId, ctx.expectedVersion);
      return {
        operationId,
        returnedVersion: version,
        responseJson: {
          operationId,
          claimId: input.claimId,
          network: input.network,
          status: "SCHEDULED",
          version
        }
      };
    });
  }

  async issueSettlement(
    input: IssueSettlementInput,
    ctx: MutationContext
  ): Promise<AdapterMutationResult> {
    return this.mutate("ISSUE_SETTLEMENT", input.claimId, input, ctx, async (client) => {
      const operationId = randomUUID();
      await client.query(
        `
          INSERT INTO claim_settlements (claim_id, amount_cents, status, idempotency_key)
          VALUES ($1, $2, 'ISSUED', $3)
        `,
        [input.claimId, input.amountCents, ctx.idempotencyKey]
      );
      const version = await this.bumpExpectedVersion(client, input.claimId, ctx.expectedVersion);
      return {
        operationId,
        returnedVersion: version,
        responseJson: {
          operationId,
          claimId: input.claimId,
          amountCents: input.amountCents,
          status: "ISSUED",
          version
        }
      };
    });
  }

  async addClaimNote(input: AddClaimNoteInput, ctx: MutationContext): Promise<AdapterMutationResult> {
    return this.mutate("ADD_CLAIM_NOTE", input.claimId, input, ctx, async (client) => {
      const operationId = randomUUID();
      await client.query(
        `
          INSERT INTO claim_notes (claim_id, body, idempotency_key)
          VALUES ($1, $2, $3)
        `,
        [input.claimId, input.body.trim(), ctx.idempotencyKey]
      );
      const version = await this.bumpExpectedVersion(client, input.claimId, ctx.expectedVersion);
      return {
        operationId,
        returnedVersion: version,
        responseJson: {
          operationId,
          claimId: input.claimId,
          body: input.body.trim(),
          version
        }
      };
    });
  }

  private async mutate(
    actionType: string,
    claimId: string,
    input: unknown,
    ctx: MutationContext,
    apply: (client: PoolClient) => Promise<{
      operationId: string;
      returnedVersion: number;
      responseJson: Record<string, unknown>;
    }>
  ): Promise<AdapterMutationResult> {
    const normalizedInputHash = inputHash(input);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ledger = await client.query<LedgerRow>(
        `
          SELECT key, normalized_input_hash, result_json, claim_version_after
          FROM enterprise_idempotency_ledger
          WHERE key = $1
          FOR UPDATE
        `,
        [ctx.idempotencyKey]
      );
      const existing = ledger.rows[0];
      if (existing) {
        if (existing.normalized_input_hash !== normalizedInputHash) {
          throw new EnterpriseError(
            "Idempotency key was reused with different input.",
            "IDEMPOTENCY_KEY_CONFLICT",
            false
          );
        }
        await client.query("COMMIT");
        return resultFromLedger(existing.claim_version_after, existing.result_json);
      }

      const applied = await apply(client);
      await client.query(
        `
          INSERT INTO enterprise_idempotency_ledger (
            key, action_type, claim_id, normalized_input_hash, result_json, claim_version_after
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          ctx.idempotencyKey,
          actionType,
          claimId,
          normalizedInputHash,
          JSON.stringify(applied.responseJson),
          applied.returnedVersion
        ]
      );
      await client.query("COMMIT");
      return {
        transportStatus: "SUCCESS_RESPONSE",
        returnedVersion: applied.returnedVersion,
        operationId: applied.operationId,
        responseJson: applied.responseJson
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async bumpExpectedVersion(
    client: PoolClient,
    claimId: string,
    expectedVersion: number,
    updates?: { reserve_amount_cents?: number }
  ): Promise<number> {
    const current = await client.query<{ version: number }>(
      "SELECT version FROM claims WHERE id = $1 FOR UPDATE",
      [claimId]
    );
    const row = current.rows[0];
    if (!row) {
      throw new Error(`Claim ${claimId} not found`);
    }
    if (row.version !== expectedVersion) {
      throw new EnterpriseVersionConflictError(
        `Expected claim version ${expectedVersion}, observed ${row.version}.`,
        row.version
      );
    }
    if (updates?.reserve_amount_cents !== undefined) {
      const result = await client.query<{ version: number }>(
        `
          UPDATE claims
          SET reserve_amount_cents = $1, version = version + 1, updated_at = now()
          WHERE id = $2 AND version = $3
          RETURNING version
        `,
        [updates.reserve_amount_cents, claimId, expectedVersion]
      );
      return this.versionFromUpdate(result.rows[0], claimId, expectedVersion);
    }
    const result = await client.query<{ version: number }>(
      `
        UPDATE claims
        SET version = version + 1, updated_at = now()
        WHERE id = $1 AND version = $2
        RETURNING version
      `,
      [claimId, expectedVersion]
    );
    return this.versionFromUpdate(result.rows[0], claimId, expectedVersion);
  }

  private versionFromUpdate(
    row: { version: number } | undefined,
    claimId: string,
    expectedVersion: number
  ): number {
    if (!row) {
      throw new EnterpriseVersionConflictError(
        `Expected claim version ${expectedVersion} for ${claimId}, but update did not apply.`
      );
    }
    return row.version;
  }
}

export function safeStringifyJson(value: unknown): string {
  return canonicalJson(value);
}
