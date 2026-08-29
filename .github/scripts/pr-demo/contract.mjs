const CONTRACT_PATTERN = /<!--\s*pr-demo:v1\s*\r?\n([\s\S]*?)\r?\n-->/g;
const CONTRACT_SIGNATURE_PATTERN = /<!--\s*pr-demo:v1\b/g;
const CONTRACT_KEYS = ["required", "spec", "tag", "viewports", "reason"];
const VIEWPORTS = new Set(["desktop", "mobile"]);

export class DemoContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "DemoContractError";
  }
}

function parseValues(block) {
  const values = new Map();

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator <= 0) {
      throw new DemoContractError(`契約行の形式が不正です: ${line}`);
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!CONTRACT_KEYS.includes(key)) {
      throw new DemoContractError(`未対応の契約キーです: ${key}`);
    }
    if (values.has(key)) {
      throw new DemoContractError(`契約キーを重複指定できません: ${key}`);
    }
    values.set(key, value);
  }

  for (const key of CONTRACT_KEYS) {
    if (!values.has(key)) {
      throw new DemoContractError(`契約キーが不足しています: ${key}`);
    }
  }

  return Object.fromEntries(values);
}

function validateRequiredContract(values) {
  if (
    !/^e2e\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(values.spec) ||
    values.spec.split("/").includes("..")
  ) {
    throw new DemoContractError("specはe2e配下の.spec.tsを指定してください");
  }
  if (!/^@demo-[1-9][0-9]*$/.test(values.tag)) {
    throw new DemoContractError("tagは@demo-<Issue番号>形式で指定してください");
  }

  const viewports = values.viewports
    .split(",")
    .map((viewport) => viewport.trim())
    .filter(Boolean);
  if (
    viewports.length === 0 ||
    viewports.some((viewport) => !VIEWPORTS.has(viewport))
  ) {
    throw new DemoContractError("viewportsはdesktopまたはmobileを指定してください");
  }
  if (new Set(viewports).size !== viewports.length) {
    throw new DemoContractError("viewportsを重複指定できません");
  }
  if (viewports.length === 2 && viewports.join(",") !== "desktop,mobile") {
    throw new DemoContractError(
      "2つのviewportsはdesktop,mobileの順で指定してください",
    );
  }

  return {
    version: 1,
    required: true,
    spec: values.spec,
    tag: values.tag,
    viewports,
    reason: values.reason,
  };
}

function validateSkippedContract(values) {
  if (!values.reason || values.reason.length > 200) {
    throw new DemoContractError("required:falseではreasonが必要です（200文字以内）");
  }
  if (values.spec || values.tag || values.viewports) {
    throw new DemoContractError(
      "required:falseではspec、tag、viewportsを空にしてください",
    );
  }

  return {
    version: 1,
    required: false,
    spec: null,
    tag: null,
    viewports: [],
    reason: values.reason,
  };
}

export function parseDemoContract(body) {
  const signatures = [...body.matchAll(CONTRACT_SIGNATURE_PATTERN)];
  const matches = [...body.matchAll(CONTRACT_PATTERN)];
  if (signatures.length !== matches.length) {
    throw new DemoContractError("pr-demo契約blockの形式が不正です");
  }
  if (matches.length === 0) {
    return null;
  }
  if (matches.length > 1) {
    throw new DemoContractError("pr-demo契約は1つだけ指定してください");
  }

  const values = parseValues(matches[0][1]);
  if (values.required !== "true" && values.required !== "false") {
    throw new DemoContractError("requiredはtrueまたはfalseを指定してください");
  }

  return values.required === "true"
    ? validateRequiredContract(values)
    : validateSkippedContract(values);
}
