import { DemoContractError, parseDemoContract } from "./contract.mjs";

const DEMO_VIDEO_LABEL = "demo-video";
const DEMO_NOT_REQUIRED_LABEL = "demo-not-required";

function isTestFile(path) {
  return /(?:^|\/)__tests__\//.test(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);
}

export function isUiPath(path) {
  if (isTestFile(path)) {
    return false;
  }
  if (path.startsWith("app/public/")) {
    return true;
  }
  if (path.startsWith("app/src/app/api/")) {
    return false;
  }
  if (path.startsWith("app/src/app/")) {
    return true;
  }
  return /^app\/src\/.*\.(?:css|scss)$/.test(path);
}

function errorDecision(reason, uiChange, contract = null) {
  return {
    schemaVersion: 1,
    outcome: "error",
    required: true,
    uiChange,
    reason,
    contract,
  };
}

function skipDecision(reason, uiChange, contract = null) {
  return {
    schemaVersion: 1,
    outcome: "skip",
    required: false,
    uiChange,
    reason,
    contract,
  };
}

export function evaluateDemoPolicy({
  body,
  labels,
  changedFiles,
  baseRepository,
  headRepository,
}) {
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  const uiChange = changedFiles.some(isUiPath);
  let contract;

  try {
    contract = parseDemoContract(body);
  } catch (error) {
    if (error instanceof DemoContractError) {
      return errorDecision(error.message, uiChange);
    }
    throw error;
  }

  const forced = normalizedLabels.has(DEMO_VIDEO_LABEL);
  const overridden = normalizedLabels.has(DEMO_NOT_REQUIRED_LABEL);
  if (forced && overridden) {
    return errorDecision(
      `${DEMO_VIDEO_LABEL}と${DEMO_NOT_REQUIRED_LABEL}は同時に指定できません`,
      uiChange,
      contract,
    );
  }

  const requiresDemo = uiChange || forced || contract?.required === true;
  if (!requiresDemo) {
    return skipDecision(
      contract?.reason ?? "ユーザー表示に影響する変更がありません",
      uiChange,
      contract,
    );
  }

  if (!contract) {
    return errorDecision("UI変更にはpr-demo契約が必要です", uiChange);
  }

  if (!contract.required) {
    if (!overridden) {
      return errorDecision(
        `UI変更を対象外にするには${DEMO_NOT_REQUIRED_LABEL}ラベルが必要です`,
        uiChange,
        contract,
      );
    }
    return skipDecision(contract.reason, uiChange, contract);
  }

  if (overridden) {
    return errorDecision(
      `${DEMO_NOT_REQUIRED_LABEL}ラベルとrequired:trueは同時に指定できません`,
      uiChange,
      contract,
    );
  }
  return {
    schemaVersion: 1,
    outcome: "capture",
    required: true,
    uiChange,
    reason: "変更点を示す動作ビデオを生成します",
    contract,
  };
}
