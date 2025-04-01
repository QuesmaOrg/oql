

export class TabularResult {
  columns: string[];
  rows: string[][];

  constructor(columns: string[], rows: string[][]) {
    this.columns = columns;
    this.rows = rows;
  }
}

export class TableDefinition {
  table: string;
  description: string;
  columns: string[];

  constructor(table: string, description: string, columns: string[]) {
    this.table = table;
    this.description = description;
    this.columns = columns;
  }
}


export class TableDefinitionResponse {
  tables: TableDefinition[];

  constructor(tables: TableDefinition[]) {
    this.tables = tables;
  }
}

export interface IpInfo {
  allocated_at: string | null;
  asn: string | null;
  asn_country: string | null;
  city: string | null;
  country_long: string | null;
  country_short: string | null;
  hostname: string | null;
  ip: string;
  isp: string | null;
  latitude: string | null;
  longitude: string | null;
  region: string | null;
  registry: string | null;
  timezone: string | null;
  zipcode: string | null;
}
