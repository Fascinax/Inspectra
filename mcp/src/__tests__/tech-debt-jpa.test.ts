import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectJpaAntiPatterns, detectMissingMigrationTool } from "../tools/tech-debt-jpa.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-jpa-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("detectJpaAntiPatterns", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, "src", "main", "java", "com", "app", "entity"), { recursive: true });
    mkdirSync(join(tempDir, "src", "main", "java", "com", "app", "repository"), { recursive: true });
    mkdirSync(join(tempDir, "src", "main", "java", "com", "app", "service"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeJava(subPath: string, content: string): void {
    const path = join(tempDir, subPath);
    writeFileSync(path, content, "utf8");
  }

  it("detects @Data on @Entity", async () => {
    writeJava("src/main/java/com/app/entity/Wire.java", `
package com.app.entity;

import lombok.Data;
import javax.persistence.Entity;

@Data
@Entity
public class Wire {
    private Long id;
    private String label;
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    const dataFindings = findings.filter((f) => f.rule === "jpa-data-on-entity");
    expect(dataFindings).toHaveLength(1);
    expect(dataFindings[0]!.severity).toBe("high");
    expect(dataFindings[0]!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("does not flag @Getter @Setter on @Entity", async () => {
    writeJava("src/main/java/com/app/entity/Clean.java", `
package com.app.entity;

import lombok.Getter;
import lombok.Setter;
import javax.persistence.Entity;

@Getter
@Setter
@Entity
public class Clean {
    private Long id;
    private String label;
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    expect(findings.filter((f) => f.rule === "jpa-data-on-entity")).toHaveLength(0);
  });

  it("detects CascadeType.ALL on @ManyToOne", async () => {
    writeJava("src/main/java/com/app/entity/Equipment.java", `
package com.app.entity;

import javax.persistence.*;

@Entity
public class Equipment {
    @ManyToOne(cascade = CascadeType.ALL)
    private Container container;
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    const cascade = findings.filter((f) => f.rule === "jpa-cascade-all-many-to-one");
    expect(cascade).toHaveLength(1);
    expect(cascade[0]!.severity).toBe("high");
  });

  it("does not flag CascadeType.ALL on @OneToMany", async () => {
    writeJava("src/main/java/com/app/entity/Parent.java", `
package com.app.entity;

import javax.persistence.*;
import java.util.List;

@Entity
public class Parent {
    @OneToMany(cascade = CascadeType.ALL, mappedBy = "parent")
    private List<Child> children;
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    expect(findings.filter((f) => f.rule === "jpa-cascade-all-many-to-one")).toHaveLength(0);
  });

  it("detects missing @Version on entity", async () => {
    writeJava("src/main/java/com/app/entity/NoVersion.java", `
package com.app.entity;

import javax.persistence.*;

@Entity
public class NoVersion {
    @Id
    @GeneratedValue
    private Long id;
    private String name;
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    const version = findings.filter((f) => f.rule === "jpa-missing-version");
    expect(version).toHaveLength(1);
    expect(version[0]!.severity).toBe("medium");
  });

  it("does not flag entity with @Version", async () => {
    writeJava("src/main/java/com/app/entity/Versioned.java", `
package com.app.entity;

import javax.persistence.*;

@Entity
public class Versioned {
    @Id private Long id;
    @Version private Long version;
    private String name;
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    expect(findings.filter((f) => f.rule === "jpa-missing-version")).toHaveLength(0);
  });

  it("detects missing @Modifying on @Query with UPDATE", async () => {
    writeJava("src/main/java/com/app/repository/WireRepo.java", `
package com.app.repository;

import org.springframework.data.jpa.repository.Query;

public interface WireRepo {
    @Query("UPDATE Wire w SET w.label = :label WHERE w.id = :id")
    void updateLabel(Long id, String label);
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    const modifying = findings.filter((f) => f.rule === "jpa-missing-modifying");
    expect(modifying).toHaveLength(1);
    expect(modifying[0]!.severity).toBe("medium");
  });

  it("does not flag @Modifying @Query", async () => {
    writeJava("src/main/java/com/app/repository/CleanRepo.java", `
package com.app.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface CleanRepo {
    @Modifying
    @Query("DELETE FROM Wire w WHERE w.id = :id")
    void deleteById(Long id);
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    expect(findings.filter((f) => f.rule === "jpa-missing-modifying")).toHaveLength(0);
  });

  it("detects missing @Modifying on multi-line mutating @Query", async () => {
    writeJava("src/main/java/com/app/repository/MultiLineRepo.java", `
package com.app.repository;

import org.springframework.data.jpa.repository.Query;

public interface MultiLineRepo {
    @Query(
        value = """
            UPDATE Wire w
            SET w.label = :label
            WHERE w.id = :id
            """
    )
    void updateLabel(Long id, String label);
}
`);

    const findings = await detectJpaAntiPatterns(tempDir);
    expect(findings.filter((finding) => finding.rule === "jpa-missing-modifying")).toHaveLength(1);
  });

  it("detects @Lazy self-injection", async () => {
    writeJava("src/main/java/com/app/service/CircularService.java", `
package com.app.service;

import org.springframework.context.annotation.Lazy;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class CircularService {
    @Lazy
    @Autowired
    private CircularService self;
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    const lazy = findings.filter((f) => f.rule === "lazy-self-injection");
    expect(lazy).toHaveLength(1);
    expect(lazy[0]!.severity).toBe("high");
  });

  it("returns empty for clean project", async () => {
    writeJava("src/main/java/com/app/service/CleanService.java", `
package com.app.service;

@Service
public class CleanService {
    public String hello() { return "world"; }
}
`);
    const findings = await detectJpaAntiPatterns(tempDir);
    expect(findings).toHaveLength(0);
  });
});

describe("detectMissingMigrationTool", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, "src", "main", "java", "com", "app", "entity"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeJava(subPath: string, content: string): void {
    writeFileSync(join(tempDir, subPath), content, "utf8");
  }

  it("flags JPA entities without migration tool", async () => {
    writeJava("src/main/java/com/app/entity/Cable.java", `
@Entity
public class Cable {
    @Id private Long id;
}
`);
    const findings = await detectMissingMigrationTool(tempDir);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe("jpa-no-migration-tool");
  });

  it("does not flag when Liquibase dependency in pom.xml", async () => {
    writeJava("src/main/java/com/app/entity/Cable.java", `
@Entity
public class Cable {
    @Id private Long id;
}
`);
    writeFileSync(join(tempDir, "pom.xml"), `<dependency><artifactId>liquibase-core</artifactId></dependency>`);
    const findings = await detectMissingMigrationTool(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("does not flag when Flyway migration directory exists", async () => {
    writeJava("src/main/java/com/app/entity/Cable.java", `
@Entity
public class Cable {
    @Id private Long id;
}
`);
    mkdirSync(join(tempDir, "src", "main", "resources", "db", "migration"), { recursive: true });
    writeFileSync(join(tempDir, "src", "main", "resources", "db", "migration", "V1__init.sql"), "CREATE TABLE cable;");
    const findings = await detectMissingMigrationTool(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("does not flag projects without entities", async () => {
    writeJava("src/main/java/com/app/entity/Dto.java", `
public class CableDto {
    private Long id;
}
`);
    const findings = await detectMissingMigrationTool(tempDir);
    expect(findings).toHaveLength(0);
  });
});
