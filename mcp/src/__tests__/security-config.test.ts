import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkSecurityConfig } from "../tools/security-config.js";

const TMP_DIR = join(tmpdir(), `inspectra-test-sec-config-${Date.now()}`);

beforeAll(() => {
  mkdirSync(join(TMP_DIR, "src", "main", "java", "com", "app"), { recursive: true });
  mkdirSync(join(TMP_DIR, "src", "main", "resources"), { recursive: true });
});

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeJava(name: string, content: string): string {
  const path = join(TMP_DIR, "src", "main", "java", "com", "app", name);
  writeFileSync(path, content, "utf8");
  return path;
}

function writeConfig(name: string, content: string): string {
  const path = join(TMP_DIR, "src", "main", "resources", name);
  writeFileSync(path, content, "utf8");
  return path;
}

function findingsForFile(findings: Awaited<ReturnType<typeof checkSecurityConfig>>, fileName: string) {
  return findings.filter((f) => f.evidence?.some((e) => e.file?.includes(fileName)));
}

describe("checkSecurityConfig", () => {
  it("returns empty findings for a secure config", async () => {
    writeJava("SecureConfig.java", `
@Configuration
public class SecureConfig extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests()
            .requestMatchers("/public/**").permitAll()
            .anyRequest().authenticated();
    }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const permitAllFindings = findingsForFile(findings, "SecureConfig.java").filter((f) => f.rule === "no-permit-all");
    expect(permitAllFindings).toHaveLength(0);
  });

  it("detects anyRequest().permitAll()", async () => {
    writeJava("OpenConfig.java", `
@Configuration
public class OpenConfig extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests()
            .anyRequest().permitAll();
    }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const permitAll = findings.filter((f) => f.rule === "no-permit-all");
    expect(permitAll.length).toBeGreaterThan(0);
    expect(permitAll[0]!.severity).toBe("critical");
    expect(permitAll[0]!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects csrf().disable()", async () => {
    writeJava("NoCsrf.java", `
@Configuration
public class NoCsrf {
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf().disable();
        return http.build();
    }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const csrf = findings.filter((f) => f.rule === "no-csrf-disable");
    expect(csrf.length).toBeGreaterThan(0);
    expect(csrf[0]!.severity).toBe("high");
  });

  it("detects csrf(AbstractHttpConfigurer::disable)", async () => {
    writeJava("NoCsrf2.java", `
@Configuration
public class NoCsrf2 {
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable);
        return http.build();
    }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const csrf = findings.filter((f) => f.rule === "no-csrf-disable");
    expect(csrf.length).toBeGreaterThan(0);
  });

  it("detects commented-out @PreAuthorize", async () => {
    writeJava("CommentedAuth.java", `
@RestController
public class CommentedAuth {
    // @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin")
    public String admin() { return "admin"; }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const commented = findings.filter((f) => f.rule === "no-commented-auth");
    expect(commented.length).toBeGreaterThan(0);
    expect(commented[0]!.severity).toBe("high");
  });

  it("detects commented-out @Secured", async () => {
    writeJava("CommentedSecured.java", `
@RestController
public class CommentedSecured {
    // @Secured("ROLE_ADMIN")
    @PostMapping("/config")
    public String config() { return "ok"; }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const commented = findings.filter((f) => f.rule === "no-commented-auth");
    expect(commented.length).toBeGreaterThan(0);
  });

  it("detects CORS wildcard with credentials", async () => {
    writeJava("CorsConfig.java", `
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOrigins("*")
            .allowCredentials(true);
    }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const cors = findings.filter((f) => f.rule === "no-cors-wildcard-credentials");
    expect(cors.length).toBeGreaterThan(0);
    expect(cors[0]!.severity).toBe("high");
  });

  it("detects CORS wildcard without credentials as medium", async () => {
    writeJava("CorsOpen.java", `
@Configuration
public class CorsOpen {
    @Bean
    CorsConfigurationSource corsSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Collections.singletonList("*"));
        return new UrlBasedCorsConfigurationSource();
    }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const cors = findings.filter((f) => f.rule === "cors-wildcard-origin");
    expect(cors.length).toBeGreaterThan(0);
    expect(cors[0]!.severity).toBe("medium");
  });

  it("detects missing @Valid on @RequestBody", async () => {
    writeJava("NoValid.java", `
@RestController
public class NoValid {
    @PostMapping("/users")
    public ResponseEntity<User> create(@RequestBody UserDTO dto) {
        return ResponseEntity.ok(service.create(dto));
    }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const missing = findings.filter((f) => f.rule === "missing-valid-annotation");
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0]!.severity).toBe("medium");
  });

  it("does not flag @Valid @RequestBody", async () => {
    writeJava("WithValid.java", `
@RestController
public class WithValid {
    @PostMapping("/users")
    public ResponseEntity<User> create(@Valid @RequestBody UserDTO dto) {
        return ResponseEntity.ok(service.create(dto));
    }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const missing = findingsForFile(findings, "WithValid.java").filter((f) => f.rule === "missing-valid-annotation");
    expect(missing).toHaveLength(0);
  });

  it("detects actuator expose all", async () => {
    writeConfig("application.properties", `
server.port=8080
management.endpoints.web.exposure.include=*
management.endpoint.health.show-details=always
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const actuator = findings.filter((f) => f.rule === "actuator-expose-all");
    expect(actuator.length).toBeGreaterThan(0);
    expect(actuator[0]!.severity).toBe("medium");
  });

  it("does not flag limited actuator exposure", async () => {
    writeConfig("application-safe.properties", `
server.port=8080
management.endpoints.web.exposure.include=health,info,prometheus
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const actuator = findingsForFile(findings, "application-safe.properties").filter((f) => f.rule === "actuator-expose-all");
    expect(actuator).toHaveLength(0);
  });

  it("finding IDs start at SEC-400", async () => {
    writeJava("IdCheck.java", `
@Configuration
public class IdCheck {
    @Bean
    SecurityFilterChain filter(HttpSecurity http) throws Exception {
        http.csrf().disable();
        return http.build();
    }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    const idNumbers = findings.map((f) => parseInt(f.id.replace("SEC-", ""), 10));
    for (const num of idNumbers) {
      expect(num).toBeGreaterThanOrEqual(400);
      expect(num).toBeLessThan(500);
    }
  });

  it("all findings have source tool and correct domain", async () => {
    writeJava("SourceCheck.java", `
@RestController
public class SourceCheck {
    // @PreAuthorize("hasRole('USER')")
    @PostMapping("/data")
    public String post(@RequestBody DataDTO data) { return "ok"; }
}
`);
    const findings = await checkSecurityConfig(TMP_DIR);
    for (const f of findings) {
      expect(f.source).toBe("tool");
      expect(f.domain).toBe("security");
      expect(f.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });
});
