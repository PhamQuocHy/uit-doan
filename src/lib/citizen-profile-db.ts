import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import type { EducationRecord, HealthRecord, ResidenceRecord } from "@/lib/data";
import { normalizeExamPhase } from "@/lib/health-exam";

function toIso(d: string | Date | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  return new Date(s).toISOString();
}

function mapEducationLevel(level: string | null): string {
  if (!level) return "12/12";
  if (level === "THPT") return "12/12";
  if (level === "THCS") return "9/12";
  if (level === "Trung cấp") return "12/12";
  return level;
}

function formatGpaNote(gpa: unknown): string | undefined {
  if (gpa == null || gpa === "") return undefined;
  const n = Number(gpa);
  if (!Number.isFinite(n)) return undefined;
  return `GPA: ${Number(n.toFixed(2))}`;
}

export async function findEducationByCitizenId(
  citizenId: string,
): Promise<EducationRecord[] | null> {
  if (!(await pingDb())) return null;
  try {
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT id, citizen_id, school_name, level, major, graduation_year, gpa
       FROM citizen_education
       WHERE citizen_id = ?
       ORDER BY graduation_year DESC, id DESC`,
      [citizenId],
    );

    const certs = await queryRows<RowDataPacket[]>(
      `SELECT id, citizen_id, cert_name, issue_org, issue_date, expiry_date
       FROM citizen_certificates
       WHERE citizen_id = ?
       ORDER BY issue_date DESC, id DESC`,
      [citizenId],
    ).catch(() => [] as RowDataPacket[]);

    const edu: EducationRecord[] = rows.map((r) => ({
      id: `edu-${r.id}`,
      citizenId: String(r.citizen_id),
      level: mapEducationLevel(r.level ? String(r.level) : null),
      institution: String(r.school_name || "Chưa ghi nhận trường"),
      major: r.major ? String(r.major) : undefined,
      graduationYear: r.graduation_year ? Number(r.graduation_year) : undefined,
      status: "completed" as const,
      note: formatGpaNote(r.gpa),
      createdAt: toIso(null),
      updatedAt: toIso(null),
    }));

    const certRecords: EducationRecord[] = certs.map((r) => ({
      id: `cert-${r.id}`,
      citizenId: String(r.citizen_id),
      level: "12/12",
      institution: String(r.issue_org || "Cơ quan cấp chứng chỉ"),
      major: String(r.cert_name),
      graduationYear: r.issue_date
        ? Number(toIso(r.issue_date as string | Date).slice(0, 4))
        : undefined,
      status: "completed" as const,
      certificateNo: undefined,
      note: "Chứng chỉ / bằng cấp",
      createdAt: toIso(r.issue_date as string | Date | null),
      updatedAt: toIso(r.issue_date as string | Date | null),
    }));

    return [...edu, ...certRecords];
  } catch (e) {
    console.error("findEducationByCitizenId:", e);
    return null;
  }
}

export async function findHealthByCitizenId(
  citizenId: string,
): Promise<HealthRecord[] | null> {
  if (!(await pingDb())) return null;
  try {
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT id, citizen_id, exam_year, exam_phase, height, weight, blood_pressure,
              vision_left, vision_right, hearing, heart_rate, conclusions_detail,
              medical_grade, doctor_id, is_qualified
       FROM health_exams
       WHERE citizen_id = ?
       ORDER BY exam_year DESC, id DESC`,
      [citizenId],
    );

    return rows.map((r) => {
      const left = r.vision_left != null ? String(r.vision_left) : "";
      const right = r.vision_right != null ? String(r.vision_right) : "";
      const vision =
        left || right ? `${left || "—"} / ${right || "—"}` : "—";
      const grade = String(r.medical_grade || "Loại 3") as HealthRecord["conclusion"];
      const phaseRaw = String(r.exam_phase || "Sơ tuyển cấp xã");
      const phase = normalizeExamPhase(phaseRaw);

      return {
        id: String(r.id),
        citizenId: String(r.citizen_id),
        year: Number(r.exam_year),
        phase,
        height: Number(r.height || 0),
        weight: Number(r.weight || 0),
        bloodPressure: String(r.blood_pressure || "—"),
        vision,
        conclusion: grade,
        doctor: r.doctor_id ? String(r.doctor_id) : "BS. Tuyển quân",
        note: r.hearing ? `Thính lực: ${r.hearing}` : undefined,
        detail: r.conclusions_detail
          ? { physicalDefects: String(r.conclusions_detail) }
          : undefined,
        createdAt: toIso(null),
        updatedAt: toIso(null),
      };
    });
  } catch (e) {
    console.error("findHealthByCitizenId:", e);
    return null;
  }
}

const RESIDENCE_TYPE_MAP: Record<string, ResidenceRecord["type"]> = {
  "Que quan": "Quê quán",
  "Thuong tru": "Thường trú",
  "Tam tru": "Tạm trú",
  "Chuyen di": "Chuyển đi",
};

export async function findResidenceByCitizenId(
  citizenId: string,
): Promise<ResidenceRecord[] | null> {
  if (!(await pingDb())) return null;
  try {
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT id, citizen_id, residence_type, address, start_year, end_year, status, decision_no, note, created_at, updated_at
       FROM citizen_residence
       WHERE citizen_id = ?
       ORDER BY
         CASE status WHEN 'current' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
         start_year DESC,
         id DESC`,
      [citizenId],
    );

    if (rows.length > 0) {
      return rows.map((r) => ({
        id: `res-${r.id}`,
        citizenId: String(r.citizen_id),
        type: RESIDENCE_TYPE_MAP[String(r.residence_type)] || "Thường trú",
        address: String(r.address),
        startYear: r.start_year != null ? Number(r.start_year) : undefined,
        endYear: r.end_year != null ? Number(r.end_year) : undefined,
        status: (r.status as ResidenceRecord["status"]) || "past",
        decisionNo: r.decision_no ? String(r.decision_no) : undefined,
        note: r.note ? String(r.note) : undefined,
        createdAt: toIso(r.created_at as string | Date),
        updatedAt: toIso(r.updated_at as string | Date),
      }));
    }

    // Fallback: synthesize from citizens row when history not yet backfilled
    const citizens = await queryRows<RowDataPacket[]>(
      `SELECT id, origin_place, permanent_address, current_address, date_of_birth
       FROM citizens WHERE id = ? LIMIT 1`,
      [citizenId],
    );
    const c = citizens[0];
    if (!c) return [];

    const birthYear = c.date_of_birth
      ? Number(toIso(c.date_of_birth as string | Date).slice(0, 4))
      : undefined;
    const out: ResidenceRecord[] = [];
    if (c.origin_place) {
      out.push({
        id: `syn-origin-${c.id}`,
        citizenId: String(c.id),
        type: "Quê quán",
        address: String(c.origin_place),
        startYear: birthYear,
        status: "past",
        createdAt: toIso(null),
        updatedAt: toIso(null),
      });
    }
    const current = c.current_address || c.permanent_address;
    if (current) {
      out.push({
        id: `syn-current-${c.id}`,
        citizenId: String(c.id),
        type: "Thường trú",
        address: String(current),
        startYear: birthYear ? birthYear + 14 : undefined,
        status: "current",
        createdAt: toIso(null),
        updatedAt: toIso(null),
      });
    }
    return out;
  } catch (e) {
    console.error("findResidenceByCitizenId:", e);
    // Table may be missing before migration — still synthesize from citizens
    try {
      const citizens = await queryRows<RowDataPacket[]>(
        `SELECT id, origin_place, permanent_address, current_address, date_of_birth
         FROM citizens WHERE id = ? LIMIT 1`,
        [citizenId],
      );
      const c = citizens[0];
      if (!c) return [];
      const birthYear = c.date_of_birth
        ? Number(toIso(c.date_of_birth as string | Date).slice(0, 4))
        : undefined;
      const out: ResidenceRecord[] = [];
      if (c.origin_place) {
        out.push({
          id: `syn-origin-${c.id}`,
          citizenId: String(c.id),
          type: "Quê quán",
          address: String(c.origin_place),
          startYear: birthYear,
          status: "past",
          createdAt: toIso(null),
          updatedAt: toIso(null),
        });
      }
      const current = c.current_address || c.permanent_address;
      if (current) {
        out.push({
          id: `syn-current-${c.id}`,
          citizenId: String(c.id),
          type: "Thường trú",
          address: String(current),
          startYear: birthYear ? birthYear + 14 : undefined,
          status: "current",
          createdAt: toIso(null),
          updatedAt: toIso(null),
        });
      }
      return out;
    } catch (e2) {
      console.error("findResidenceByCitizenId fallback:", e2);
      return null;
    }
  }
}

export async function insertHealthExam(record: {
  id: string;
  citizenId: string;
  year: number;
  phase: string;
  height: number;
  weight: number;
  bloodPressure: string;
  visionLeft: string;
  visionRight: string;
  hearing?: string;
  heartRate?: number;
  conclusionsDetail?: string;
  medicalGrade: string;
  doctorId?: string;
  isQualified: boolean;
}): Promise<void> {
  await queryExecute(
    `INSERT INTO health_exams (
      id, citizen_id, exam_year, exam_phase, height, weight, blood_pressure,
      vision_left, vision_right, hearing, heart_rate, conclusions_detail,
      medical_grade, doctor_id, is_qualified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.citizenId,
      record.year,
      record.phase,
      record.height,
      record.weight,
      record.bloodPressure,
      record.visionLeft,
      record.visionRight,
      record.hearing || null,
      record.heartRate ?? null,
      record.conclusionsDetail || null,
      record.medicalGrade,
      record.doctorId || null,
      record.isQualified ? 1 : 0,
    ],
  );
}

const RESIDENCE_TYPE_TO_DB: Record<string, string> = {
  "Quê quán": "Que quan",
  "Thường trú": "Thuong tru",
  "Tạm trú": "Tam tru",
  "Chuyển đi": "Chuyen di",
};

export async function insertEducationRecord(input: {
  citizenId: string;
  institution: string;
  level: string;
  major?: string;
  graduationYear?: number;
  gpa?: number;
}): Promise<EducationRecord | null> {
  if (!(await pingDb())) return null;
  try {
    const levelDb =
      input.level === "12/12"
        ? "THPT"
        : input.level === "9/12"
          ? "THCS"
          : input.level;
    const major = input.major?.trim() || null;
    const result = await queryExecute(
      `INSERT INTO citizen_education
        (citizen_id, school_name, level, major, graduation_year, gpa)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.citizenId,
        input.institution.trim(),
        levelDb,
        major,
        input.graduationYear ?? null,
        input.gpa ?? null,
      ],
    );
    const id = Number(result.insertId);
    return {
      id: `edu-${id}`,
      citizenId: input.citizenId,
      level: mapEducationLevel(levelDb),
      institution: input.institution.trim(),
      major: major || undefined,
      graduationYear: input.graduationYear,
      status: "completed",
      note: formatGpaNote(input.gpa),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("insertEducationRecord:", e);
    return null;
  }
}

/** Cập nhật bản ghi học vấn (id dạng edu-123 hoặc số). */
export async function updateEducationRecord(
  recordId: string,
  patch: {
    institution?: string;
    level?: string;
    major?: string;
    graduationYear?: number | null;
    gpa?: number | null;
  },
): Promise<EducationRecord | null> {
  if (!(await pingDb())) return null;
  const raw = String(recordId).replace(/^edu-/, "");
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;

  try {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (patch.institution !== undefined) {
      fields.push("school_name = ?");
      params.push(patch.institution.trim() || null);
    }
    if (patch.level !== undefined) {
      const levelDb =
        patch.level === "12/12"
          ? "THPT"
          : patch.level === "9/12"
            ? "THCS"
            : patch.level;
      fields.push("level = ?");
      params.push(levelDb || null);
    }
    if (patch.major !== undefined) {
      fields.push("major = ?");
      params.push(patch.major.trim() || null);
    }
    if (patch.graduationYear !== undefined) {
      fields.push("graduation_year = ?");
      params.push(patch.graduationYear);
    }
    if (patch.gpa !== undefined) {
      fields.push("gpa = ?");
      params.push(patch.gpa);
    }
    if (!fields.length) return null;

    await queryExecute(
      `UPDATE citizen_education SET ${fields.join(", ")} WHERE id = ?`,
      [...params, id],
    );

    const rows = await queryRows<RowDataPacket[]>(
      `SELECT id, citizen_id, school_name, level, major, graduation_year, gpa
       FROM citizen_education WHERE id = ? LIMIT 1`,
      [id],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: `edu-${r.id}`,
      citizenId: String(r.citizen_id),
      level: mapEducationLevel(r.level ? String(r.level) : null),
      institution: String(r.school_name || "Chưa ghi nhận trường"),
      major: r.major ? String(r.major) : undefined,
      graduationYear: r.graduation_year ? Number(r.graduation_year) : undefined,
      status: "completed",
      note: formatGpaNote(r.gpa),
      createdAt: toIso(null),
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("updateEducationRecord:", e);
    return null;
  }
}

export async function insertResidenceRecord(input: {
  citizenId: string;
  type: ResidenceRecord["type"];
  address: string;
  startYear?: number;
  endYear?: number;
  status: ResidenceRecord["status"];
  decisionNo?: string;
  note?: string;
}): Promise<ResidenceRecord | null> {
  if (!(await pingDb())) return null;
  try {
    const dbType = RESIDENCE_TYPE_TO_DB[input.type] || "Thuong tru";
    // Khi thêm chỗ đang cư trú → đánh dấu bản ghi current cũ thành past
    if (input.status === "current") {
      await queryExecute(
        `UPDATE citizen_residence SET status = 'past', end_year = COALESCE(end_year, ?)
         WHERE citizen_id = ? AND status = 'current'`,
        [input.startYear ? input.startYear - 1 : new Date().getFullYear(), input.citizenId],
      );
      await queryExecute(
        `UPDATE citizens SET current_address = ?, permanent_address = COALESCE(permanent_address, ?)
         WHERE id = ?`,
        [input.address.trim(), input.address.trim(), input.citizenId],
      );
    }
    if (input.type === "Quê quán") {
      await queryExecute(`UPDATE citizens SET origin_place = ? WHERE id = ?`, [
        input.address.trim(),
        input.citizenId,
      ]);
    }

    const result = await queryExecute(
      `INSERT INTO citizen_residence
        (citizen_id, residence_type, address, start_year, end_year, status, decision_no, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.citizenId,
        dbType,
        input.address.trim(),
        input.startYear ?? null,
        input.endYear ?? null,
        input.status,
        input.decisionNo?.trim() || null,
        input.note?.trim() || null,
      ],
    );
    const id = Number(result.insertId);
    return {
      id: `res-${id}`,
      citizenId: input.citizenId,
      type: input.type,
      address: input.address.trim(),
      startYear: input.startYear,
      endYear: input.endYear,
      status: input.status,
      decisionNo: input.decisionNo,
      note: input.note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("insertResidenceRecord:", e);
    return null;
  }
}
