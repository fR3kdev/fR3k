import { test } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { startDashboard } from "../src/dashboard/server.js";
import { createFixtureBridge } from "../src/dashboard/fixture.js";
test("dashboard API protects mutations and delegates exact approvals", async (t) => {
  const bridge = createFixtureBridge();
  let actor = "";
  const approve = bridge.approve;
  bridge.approve = async (...args) => {
    actor = args[2];
    return approve(...args);
  };
  const app = await startDashboard({ bridge, port: 0, actor: "trusted-host" });
  t.after(app.close);
  const page = await (await fetch(app.url)).text();
  const token = /name="dashboard-token" content="([^"]+)"/.exec(page)![1]!;
  const post = (
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(app.url + path, {
      method: "POST",
      headers: {
        Origin: app.url,
        "Content-Type": "application/json",
        "X-Dashboard-Token": token,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  assert.equal((await (await fetch(app.url + "/api/runs")).json()).length, 8);
  assert.equal((await fetch(app.url + "/api/runs/missing")).status, 404);
  assert.equal(
    (
      await post("/api/runs/approval/approval", {
        digest: "fixture-digest",
        allow: true,
        actor: "attacker",
      })
    ).status,
    400,
  );
  for (const headers of [
    { "X-Dashboard-Token": "" },
    { "X-Dashboard-Token": "é".repeat(64) },
    { Origin: "https://evil.example" },
    { Origin: "" },
  ] as Array<Record<string,string>>)
    assert.equal(
      (
        await post(
          "/api/runs/approval/approval",
          { digest: "fixture-digest", allow: true },
          headers,
        )
      ).status,
      403,
    );
  assert.equal(
    (
      await post("/api/runs/approval/approval", {
        digest: "stale",
        allow: true,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post("/api/runs/expired/approval", {
        digest: "fixture-digest",
        allow: true,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post("/api/runs/approval/approval", {
        digest: "fixture-digest",
        allow: true,
      })
    ).status,
    200,
  );
  assert.equal(actor, "trusted-host");
  assert.equal((await bridge.inspect("approval")).status, "RUNNING");
  assert.equal((await post("/api/runs/expired/resume", {})).status, 202);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(
    (
      await post("/api/runs/expired/approval", {
        digest: "fixture-digest",
        allow: false,
      })
    ).status,
    200,
  );
  assert.equal((await bridge.inspect("expired")).status, "DENIED_BY_POLICY");
  assert.equal(
    (await post("/api/runs/active/resume", { padding: "x".repeat(17000) }))
      .status,
    413,
  );
  assert.equal(
    (await fetch(app.url + "/api/runs/%2e%2e%2fsecret")).status,
    400,
  );
  assert.equal(
    (
      await fetch(app.url + "/api/runs", {
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    await new Promise((resolve) => {
      request(app.url, { headers: { Host: "evil.example" } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      }).end();
    }),
    403,
  );
  const comparison = await (
    await fetch(app.url + "/api/compare?baseline=success&candidate=failure")
  ).json();
  assert.equal(comparison.runs[0].costUsd, null);
  assert.ok(!page.includes("<img"));
  const js = await (await fetch(app.url + "/app.js")).text();
  assert.ok(!js.includes("innerHTML"));
});
test("resume returns immediately, rejects overlap and exposes background errors", async (t) => {
  const bridge = createFixtureBridge();
  let reject!: (error: Error) => void;
  bridge.resume = () =>
    new Promise((_, r) => {
      reject = r;
    });
  const app = await startDashboard({ bridge, port: 0 });
  t.after(app.close);
  const page = await (await fetch(app.url)).text();
  const token = /name="dashboard-token" content="([^"]+)"/.exec(page)![1]!;
  const resume = () =>
    fetch(app.url + "/api/runs/active/resume", {
      method: "POST",
      headers: {
        Origin: app.url,
        "Content-Type": "application/json",
        "X-Dashboard-Token": token,
      },
      body: "{}",
    });
  assert.equal((await resume()).status, 202);
  assert.equal((await resume()).status, 409);
  assert.equal(
    (await (await fetch(app.url + "/api/runs/active")).json()).dashboard
      .resuming,
    true,
  );
  reject(new Error("Connector unavailable"));
  await new Promise((r) => setTimeout(r, 10));
  const view = await (await fetch(app.url + "/api/runs/active")).json();
  assert.equal(view.dashboard.resuming, false);
  assert.equal(view.dashboard.resumeError, "Connector unavailable");
});
