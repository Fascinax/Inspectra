import type { Finding, Severity, Domain, Effort } from "../types.js";
import type { IdGenerator } from "./id.js";

interface Evidence {
  file: string;
  line?: number;
  snippet?: string;
}

const MAX_SNIPPET_LENGTH = 120;

export class FindingBuilder {
  private _id: string | undefined;
  private _severity: Severity | undefined;
  private _title: string | undefined;
  private _description: string | undefined;
  private _domain: Domain | undefined;
  private _rule: string | undefined;
  private _confidence: number | undefined;
  private _evidence: Evidence[] = [];
  private _recommendation: string | undefined;
  private _effort: Effort | undefined;
  private _tags: string[] | undefined;
  private _source: "tool" | "llm" = "tool";

  constructor(private readonly nextId: IdGenerator) {}

  severity(value: Severity): this {
    this._severity = value;
    return this;
  }

  title(value: string): this {
    this._title = value;
    return this;
  }

  description(value: string): this {
    this._description = value;
    return this;
  }

  domain(value: Domain): this {
    this._domain = value;
    return this;
  }

  rule(value: string): this {
    this._rule = value;
    return this;
  }

  confidence(value: number): this {
    this._confidence = value;
    return this;
  }

  file(path: string, line?: number, snippet?: string): this {
    const evidence: Evidence = { file: path };
    if (line !== undefined) evidence.line = line;
    if (snippet !== undefined) evidence.snippet = snippet.substring(0, MAX_SNIPPET_LENGTH);
    this._evidence.push(evidence);
    return this;
  }

  recommendation(value: string): this {
    this._recommendation = value;
    return this;
  }

  effort(value: Effort): this {
    this._effort = value;
    return this;
  }

  tags(value: string[]): this {
    this._tags = value;
    return this;
  }

  source(value: "tool" | "llm"): this {
    this._source = value;
    return this;
  }

  build(): Finding {
    if (!this._severity) throw new Error("FindingBuilder: severity is required");
    if (!this._title) throw new Error("FindingBuilder: title is required");
    if (!this._domain) throw new Error("FindingBuilder: domain is required");
    if (!this._rule) throw new Error("FindingBuilder: rule is required");
    if (this._confidence === undefined) throw new Error("FindingBuilder: confidence is required");
    if (this._evidence.length === 0) throw new Error("FindingBuilder: at least one evidence is required");

    const finding: Finding = {
      id: this._id ?? this.nextId(),
      severity: this._severity,
      title: this._title,
      domain: this._domain,
      rule: this._rule,
      confidence: this._confidence,
      evidence: this._evidence,
      source: this._source,
    };

    if (this._description) finding.description = this._description;
    if (this._recommendation) finding.recommendation = this._recommendation;
    if (this._effort) finding.effort = this._effort;
    if (this._tags) finding.tags = this._tags;

    return finding;
  }
}

export function finding(nextId: IdGenerator): FindingBuilder {
  return new FindingBuilder(nextId);
}
