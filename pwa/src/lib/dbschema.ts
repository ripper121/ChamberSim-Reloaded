export type ProjectTable = "caliber" | "projectile" | "propellant";
export type RecordSource = "project" | "own" | "original";
export type ProjectRecord = Record<string, string | number | boolean> & { source: RecordSource; id: number };

export interface DatabaseColumn {
  name: string;
  numeric?: boolean;
  boolean?: boolean;
  date?: boolean;
}

const columnNames: Record<ProjectTable, readonly string[]> = {
  caliber: (`cipname altname standard ciporigin ciptype primer cipdate ciprevdate cippdf L0 L1 L2 L3 L4 L5 L6 R R1 R3 E E1 Emin delta FG beta P0 P1 P2 alpha S r1min r2 H1 H2 G1 G2 f L3G Pmax PmaxSAAMI PK PE EE V M c_L0 c_L1 c_L2 c_L3 c_R c_R1 c_R2 c_R3 c_r_ c_E c_P0 c_P1 c_P2 c_alpha c_S c_r1max c_r2_ c_H1 c_H2 c_G c_G1 c_alpha1 c_h_ c_s_ c_i_ c_w_ c_F c_Z c_b_ c_N c_u_ c_Q c_delta c_Fe c_Fe_proof c_Fe_auto sebert cdate cby mdate mby type mode status origin descr`).split(" "),
  projectile: (`mname pname lotid caliber gdia glen gValid gmass gpressure gfriction gtaildiaA gtaildiaB gtailh gtailtype gdepthmax g1bc g7bc gUBCS cdate cby mdate mby type mode status origin descr imageUuid`).split(" "),
  propellant: (`mname pname lotid Br Bp Brp Ba Qex k eta a0 a1 z1 z2 pc pcd pt tcc tch Lp Lr L01 L02 L03 L04 L05 L06 L07 L08 L09 Qlty cdate cby mdate mby type mode status origin descr imageUuid imageDetailUuid`).split(" ")
};

const textColumns = new Set([
  "source", "cipname", "altname", "standard", "ciporigin", "ciptype", "primer", "cipdate", "ciprevdate", "cippdf",
  "delta", "beta", "alpha", "M", "cdate", "cby", "mdate", "mby", "type", "mode", "status", "origin", "descr",
  "mname", "pname", "lotid", "caliber", "gUBCS", "imageUuid", "imageDetailUuid"
]);
const dateColumns = new Set(["cipdate", "ciprevdate", "cdate", "mdate"]);

function columnsFor(table: ProjectTable): DatabaseColumn[] {
  return [
    { name: "source" }, { name: "id", numeric: true },
    ...columnNames[table].map((name) => ({ name, numeric: !textColumns.has(name) && name !== "gValid", boolean: name === "gValid", date: dateColumns.has(name) }))
  ];
}

export const databaseColumns: Record<ProjectTable, readonly DatabaseColumn[]> = {
  caliber: columnsFor("caliber"), projectile: columnsFor("projectile"), propellant: columnsFor("propellant")
};
